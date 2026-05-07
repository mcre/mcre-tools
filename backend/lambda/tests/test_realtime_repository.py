import importlib
import pathlib
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock


LAMBDA_ROOT = pathlib.Path(__file__).resolve().parents[1] / "src"


def fixed_now() -> datetime:
    return datetime(2026, 5, 8, 9, 30, 0, tzinfo=timezone.utc)


class RealtimeRepositoryTest(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(LAMBDA_ROOT))
        for module_name in ["realtime.repository"]:
            sys.modules.pop(module_name, None)

    def tearDown(self):
        sys.path = [path for path in sys.path if path != str(LAMBDA_ROOT)]
        for module_name in ["realtime.repository"]:
            sys.modules.pop(module_name, None)

    def test_create_room_puts_canonical_state_with_prefixes_and_expiry(self):
        repository = importlib.import_module("realtime.repository")
        now = fixed_now()

        with mock.patch("realtime.repository._put_item") as put_item:
            repository.create_room("room_abc", "hashed-host-token", now)

        put_item.assert_called_once()
        item = put_item.call_args.args[0]
        created_at = int(now.timestamp())

        self.assertEqual(item["id"], "GroupRouletteRoom|room_abc")
        self.assertEqual(item["order"], created_at)
        self.assertEqual(item["created_at"], created_at)
        self.assertEqual(item["updated_at"], created_at)
        self.assertEqual(item["expires_at"], int((now + timedelta(hours=24)).timestamp()))
        self.assertEqual(item["ttl"], int((now + timedelta(days=90)).timestamp()))
        self.assertEqual(item["host_token_hash"], "hashed-host-token")
        self.assertEqual(item["status"], "waiting")
        self.assertEqual(item["revision"], 1)
        self.assertTrue(item["guest_add_enabled"])
        self.assertEqual(item["guest_sequence"], 0)
        self.assertEqual(item["option_sequence"], 0)
        self.assertEqual(item["active_options"], [])
        self.assertIsNone(item["current_spin"])
        self.assertEqual(
            put_item.call_args.kwargs["condition_expression"],
            "attribute_not_exists(id)",
        )

    def test_record_builders_use_primary_table_prefixes_lookup_keys_order_and_ttl(self):
        repository = importlib.import_module("realtime.repository")
        now = fixed_now()

        member = repository.member_item(
            "room_abc",
            "member_1",
            display_name="ゲスト1",
            role="guest",
            now=now,
        )
        connection = repository.connection_item(
            "conn_1",
            tool="group-roulette",
            room_id="room_abc",
            member_id="member_1",
            now=now,
        )
        option = repository.option_item(
            "room_abc",
            "option_1",
            label="Pizza",
            added_by_member_id="member_1",
            order=1,
            now=now,
        )
        event = repository.event_item(
            "room_abc",
            "event_1",
            event_type="optionAdded",
            member_id="member_1",
            payload={"optionId": "option_1"},
            now=now,
        )
        request = repository.request_item(
            "room_abc",
            "req_1",
            member_id="member_1",
            request_type="addOption",
            now=now,
        )

        raw_ttl = int((now + timedelta(days=90)).timestamp())
        connection_ttl = int((now + timedelta(hours=2)).timestamp())
        request_ttl = int((now + timedelta(days=1)).timestamp())
        event_order = int(now.timestamp())

        self.assertEqual(member["id"], "GroupRouletteMember|room_abc|member_1")
        self.assertEqual(member["search_key_1"], "GroupRouletteMember|room_id=room_abc")
        self.assertEqual(member["order"], event_order)
        self.assertEqual(member["ttl"], raw_ttl)

        self.assertEqual(connection["id"], "RealtimeConnection|conn_1")
        self.assertEqual(
            connection["search_key_1"],
            "RealtimeConnection|tool=group-roulette|room_id=room_abc",
        )
        self.assertEqual(connection["order"], event_order)
        self.assertEqual(connection["ttl"], connection_ttl)

        self.assertEqual(option["id"], "GroupRouletteOption|room_abc|option_1")
        self.assertEqual(option["search_key_1"], "GroupRouletteOption|room_id=room_abc")
        self.assertEqual(option["order"], 1)
        self.assertEqual(option["ttl"], raw_ttl)

        self.assertEqual(event["id"], "GroupRouletteEvent|room_abc|event_1")
        self.assertEqual(event["search_key_1"], "GroupRouletteEvent|room_id=room_abc")
        self.assertEqual(event["order"], event_order)
        self.assertEqual(event["ttl"], raw_ttl)

        self.assertEqual(request["id"], "RealtimeRequest|room_abc|req_1")
        self.assertEqual(request["ttl"], request_ttl)

    def test_add_option_transacts_against_room_state_not_gsi_query(self):
        repository = importlib.import_module("realtime.repository")
        now = fixed_now()
        existing_option = {
            "id": "option_2",
            "label": "Sushi",
            "order": 2,
            "added_by_member_id": "member_0",
        }
        room = {
            "id": "GroupRouletteRoom|room_abc",
            "revision": 7,
            "status": "waiting",
            "expires_at": int((now + timedelta(hours=1)).timestamp()),
            "option_sequence": 2,
            "active_options": [existing_option],
        }

        with (
            mock.patch("realtime.repository._get_room", return_value=room) as get_room,
            mock.patch("realtime.repository._write_transaction") as write_transaction,
        ):
            result = repository.add_option(
                "room_abc",
                "member_1",
                "req_1",
                "Pizza",
                now,
            )

        get_room.assert_called_once_with("room_abc")
        write_transaction.assert_called_once()
        transaction = write_transaction.call_args.args[0]
        room_update = transaction[0]["Update"]
        values = room_update["ExpressionAttributeValues"]

        new_option = {
            "id": "option_3",
            "label": "Pizza",
            "order": 3,
            "added_by_member_id": "member_1",
        }
        self.assertEqual(room_update["Key"], {"id": "GroupRouletteRoom|room_abc"})
        self.assertEqual(values[":active_options"], [existing_option, new_option])
        self.assertEqual(values[":option_sequence"], 3)
        self.assertEqual(values[":expected_revision"], 7)
        self.assertEqual(values[":next_revision"], 8)
        self.assertEqual(result["option"], new_option)
        self.assertEqual(result["revision"], 8)

        option_put = transaction[1]["Put"]["Item"]
        self.assertEqual(option_put["id"], "GroupRouletteOption|room_abc|option_3")
        self.assertEqual(option_put["order"], 3)
        self.assertEqual(option_put["label"], "Pizza")

    def test_add_option_transaction_has_revision_expiry_status_and_idempotency_conditions(
        self,
    ):
        repository = importlib.import_module("realtime.repository")
        now = fixed_now()
        room = {
            "id": "GroupRouletteRoom|room_abc",
            "revision": 3,
            "status": "waiting",
            "expires_at": int((now + timedelta(hours=1)).timestamp()),
            "option_sequence": 1,
            "active_options": [],
        }

        with (
            mock.patch("realtime.repository._get_room", return_value=room),
            mock.patch("realtime.repository._write_transaction") as write_transaction,
        ):
            repository.add_option("room_abc", "member_1", "req_1", "Pizza", now)

        transaction = write_transaction.call_args.args[0]
        room_condition = transaction[0]["Update"]["ConditionExpression"]
        request_put = next(
            item["Put"]
            for item in transaction
            if item.get("Put", {}).get("Item", {}).get("id")
            == "RealtimeRequest|room_abc|req_1"
        )

        self.assertIn("attribute_exists(id)", room_condition)
        self.assertIn("revision = :expected_revision", room_condition)
        self.assertIn("expires_at > :now", room_condition)
        self.assertIn("#status = :waiting", room_condition)
        self.assertEqual(
            request_put["ConditionExpression"],
            "attribute_not_exists(id)",
        )


if __name__ == "__main__":
    unittest.main()
