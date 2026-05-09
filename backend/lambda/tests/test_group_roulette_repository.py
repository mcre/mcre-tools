import importlib
import hashlib
import pathlib
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock


LAMBDA_ROOT = pathlib.Path(__file__).resolve().parents[1] / "src"


def fixed_now() -> datetime:
    return datetime(2026, 5, 8, 9, 30, 0, tzinfo=timezone.utc)


class GroupRouletteRepositoryTest(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(LAMBDA_ROOT))
        for module_name in ["group_roulette_core.repository"]:
            sys.modules.pop(module_name, None)

    def tearDown(self):
        sys.path = [path for path in sys.path if path != str(LAMBDA_ROOT)]
        for module_name in ["group_roulette_core.repository"]:
            sys.modules.pop(module_name, None)

    def test_create_room_transacts_canonical_state_and_host_member(self):
        repository = importlib.import_module("group_roulette_core.repository")
        now = fixed_now()

        with (
            mock.patch(
                "group_roulette_core.repository._new_member_id",
                return_value="member_host",
            ),
            mock.patch(
                "group_roulette_core.repository._write_transaction"
            ) as write_transaction,
        ):
            result = repository.create_room("room_abc", "hashed-host-token", now)

        transaction = write_transaction.call_args.args[0]
        room_put = next(
            item["Put"]
            for item in transaction
            if item.get("Put", {}).get("Item", {}).get("id")
            == "GroupRouletteRoom|room_abc"
        )
        member_put = next(
            item["Put"]
            for item in transaction
            if item.get("Put", {}).get("Item", {}).get("id")
            == "GroupRouletteMember|room_abc|member_host"
        )
        item = room_put["Item"]
        member = member_put["Item"]
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
        self.assertEqual(room_put["ConditionExpression"], "attribute_not_exists(id)")
        self.assertEqual(member["display_name"], "ホスト")
        self.assertEqual(member["role"], "host")
        self.assertEqual(member_put["ConditionExpression"], "attribute_not_exists(id)")
        self.assertEqual(result["room"], item)
        self.assertEqual(
            result["member"],
            {
                "id": "member_host",
                "display_name": "ホスト",
                "role": "host",
            },
        )
        self.assertNotIn("host_secret", str(transaction))

    def test_record_builders_use_group_roulette_request_prefixes(self):
        repository = importlib.import_module("group_roulette_core.repository")
        now = fixed_now()

        member = repository.member_item(
            "room_abc",
            "member_1",
            display_name="ゲスト1",
            role="guest",
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
            payload_hash="hash",
            now=now,
        )

        raw_ttl = int((now + timedelta(days=90)).timestamp())
        request_ttl = int((now + timedelta(days=1)).timestamp())

        self.assertEqual(member["id"], "GroupRouletteMember|room_abc|member_1")
        self.assertEqual(member["search_key_1"], "GroupRouletteMember|room_id=room_abc")
        self.assertEqual(member["ttl"], raw_ttl)
        self.assertEqual(option["id"], "GroupRouletteOption|room_abc|option_1")
        self.assertEqual(option["search_key_1"], "GroupRouletteOption|room_id=room_abc")
        self.assertEqual(event["id"], "GroupRouletteEvent|room_abc|event_1")
        self.assertEqual(event["search_key_1"], "GroupRouletteEvent|room_id=room_abc")
        self.assertEqual(request["id"], "GroupRouletteRequest|room_abc|req_1")
        self.assertEqual(request["payload_hash"], "hash")
        self.assertEqual(request["ttl"], request_ttl)

    def test_join_room_assigns_host_or_guest_without_connection_records(self):
        repository = importlib.import_module("group_roulette_core.repository")
        now = fixed_now()
        host_token = "host_secret"
        room = {
            "id": "GroupRouletteRoom|room_abc",
            "revision": 4,
            "status": "waiting",
            "expires_at": int((now + timedelta(hours=1)).timestamp()),
            "host_token_hash": hashlib.sha256(host_token.encode("utf-8")).hexdigest(),
            "guest_add_enabled": True,
            "guest_sequence": 2,
            "active_options": [],
            "current_spin": None,
        }

        with (
            mock.patch("group_roulette_core.repository._get_room", return_value=room),
            mock.patch("group_roulette_core.repository._get_request", return_value=None),
            mock.patch("group_roulette_core.repository._write_transaction") as write_transaction,
        ):
            host_result = repository.join_room(
                "room_abc",
                member_id="member_host",
                request_id="req_join",
                display_name="主催者",
                host_token=host_token,
                now=now,
            )

        transaction = write_transaction.call_args.args[0]
        put_ids = [item["Put"]["Item"]["id"] for item in transaction if "Put" in item]

        self.assertIn("GroupRouletteMember|room_abc|member_host", put_ids)
        self.assertNotIn("RealtimeConnection|conn_1", put_ids)
        self.assertEqual(host_result["member"]["role"], "host")
        self.assertEqual(host_result["member"]["display_name"], "主催者")

    def test_add_option_transacts_against_room_state_and_idempotency(self):
        repository = importlib.import_module("group_roulette_core.repository")
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
            "guest_add_enabled": True,
            "option_sequence": 2,
            "active_options": [existing_option],
            "current_spin": None,
        }

        with (
            mock.patch("group_roulette_core.repository._get_room", return_value=room),
            mock.patch("group_roulette_core.repository._get_request", return_value=None),
            mock.patch("group_roulette_core.repository._get_member", return_value={"role": "guest"}),
            mock.patch("group_roulette_core.repository._write_transaction") as write_transaction,
        ):
            result = repository.add_option(
                "room_abc",
                member_id="member_1",
                request_id="req_add",
                label="Pizza",
                host_token=None,
                now=now,
            )

        transaction = write_transaction.call_args.args[0]
        room_update = transaction[0]["Update"]
        values = room_update["ExpressionAttributeValues"]
        request_put = next(
            item["Put"]
            for item in transaction
            if item.get("Put", {}).get("Item", {}).get("id")
            == "GroupRouletteRequest|room_abc|req_add"
        )
        new_option = {
            "id": "option_3",
            "label": "Pizza",
            "order": 3,
            "added_by_member_id": "member_1",
        }

        self.assertEqual(room_update["Key"], {"id": "GroupRouletteRoom|room_abc"})
        self.assertIn("revision = :expected_revision", room_update["ConditionExpression"])
        self.assertIn("expires_at > :now", room_update["ConditionExpression"])
        self.assertIn("#status IN (:waiting, :result)", room_update["ConditionExpression"])
        self.assertEqual(values[":active_options"], [existing_option, new_option])
        self.assertEqual(values[":next_revision"], 8)
        self.assertEqual(request_put["ConditionExpression"], "attribute_not_exists(id)")
        self.assertEqual(result["room"]["revision"], 8)

    def test_remove_option_and_guest_add_toggle_require_host_token(self):
        repository = importlib.import_module("group_roulette_core.repository")
        now = fixed_now()
        host_token = "host_secret"
        room = {
            "id": "GroupRouletteRoom|room_abc",
            "revision": 7,
            "status": "waiting",
            "expires_at": int((now + timedelta(hours=1)).timestamp()),
            "host_token_hash": hashlib.sha256(host_token.encode("utf-8")).hexdigest(),
            "guest_add_enabled": True,
            "active_options": [{"id": "option_1", "label": "Pizza", "order": 1}],
            "current_spin": None,
        }

        with (
            mock.patch("group_roulette_core.repository._get_room", return_value=room),
            mock.patch("group_roulette_core.repository._get_request", return_value=None),
            mock.patch("group_roulette_core.repository._get_member", return_value={"role": "host"}),
            mock.patch("group_roulette_core.repository._write_transaction") as write_transaction,
        ):
            remove_result = repository.remove_option(
                "room_abc",
                member_id="member_1",
                request_id="req_remove",
                option_id="option_1",
                host_token=host_token,
                now=now,
            )
            toggle_result = repository.set_guest_add_enabled(
                "room_abc",
                member_id="member_1",
                request_id="req_toggle",
                enabled=False,
                host_token=host_token,
                now=now,
            )

        self.assertEqual(remove_result["room"]["active_options"], [])
        self.assertFalse(toggle_result["room"]["guest_add_enabled"])
        self.assertEqual(write_transaction.call_count, 2)

        with mock.patch("group_roulette_core.repository._get_room", return_value=room):
            with self.assertRaises(repository.PermissionDeniedError):
                repository.remove_option(
                    "room_abc",
                    member_id="member_1",
                    request_id="req_bad",
                    option_id="option_1",
                    host_token="bad",
                    now=now,
                )

    def test_start_and_stop_spin_use_snapshot_server_times_and_winner(self):
        repository = importlib.import_module("group_roulette_core.repository")
        now = fixed_now()
        host_token = "host_secret"
        room = {
            "id": "GroupRouletteRoom|room_abc",
            "revision": 3,
            "status": "waiting",
            "expires_at": int((now + timedelta(hours=1)).timestamp()),
            "host_token_hash": hashlib.sha256(host_token.encode("utf-8")).hexdigest(),
            "active_options": [
                {"id": "option_1", "label": "Pizza", "order": 1},
                {"id": "option_2", "label": "Sushi", "order": 2},
            ],
            "current_spin": None,
        }
        spinning_room = {
            **room,
            "revision": 4,
            "status": "spinning",
            "current_spin": {
                "id": "spin_1",
                "started_at": int(now.timestamp()),
                "duration_ms": 5000,
                "options": room["active_options"],
            },
        }

        with (
            mock.patch(
                "group_roulette_core.repository._get_room",
                side_effect=[room, spinning_room],
            ),
            mock.patch("group_roulette_core.repository._get_request", return_value=None),
            mock.patch("group_roulette_core.repository._get_member", return_value={"role": "host"}),
            mock.patch("group_roulette_core.repository._write_transaction") as write_transaction,
        ):
            start_result = repository.start_spin(
                "room_abc",
                member_id="member_1",
                request_id="req_start",
                host_token=host_token,
                now=now,
            )
            stop_result = repository.stop_spin(
                "room_abc",
                member_id="member_1",
                request_id="req_stop",
                host_token=host_token,
                winner_index=1,
                now=now,
            )

        self.assertEqual(start_result["room"]["status"], "spinning")
        self.assertEqual(
            start_result["room"]["current_spin"]["options"],
            room["active_options"],
        )
        self.assertEqual(stop_result["room"]["status"], "stopping")
        self.assertEqual(stop_result["room"]["current_spin"]["winner_option_id"], "option_2")
        self.assertEqual(
            stop_result["room"]["current_spin"]["stop_at"],
            int((now + timedelta(seconds=3)).timestamp()),
        )
        self.assertEqual(write_transaction.call_count, 2)

    def test_get_room_state_advances_stopping_room_after_stop_at(self):
        repository = importlib.import_module("group_roulette_core.repository")
        now = fixed_now()
        room = {
            "id": "GroupRouletteRoom|room_abc",
            "revision": 8,
            "status": "stopping",
            "expires_at": int((now + timedelta(hours=1)).timestamp()),
            "active_options": [{"id": "option_1", "label": "Pizza", "order": 1}],
            "current_spin": {
                "id": "spin_1",
                "started_at": int((now - timedelta(seconds=10)).timestamp()),
                "duration_ms": 5000,
                "options": [{"id": "option_1", "label": "Pizza", "order": 1}],
                "winner_option_id": "option_1",
                "stop_at": int((now - timedelta(seconds=1)).timestamp()),
            },
        }
        result_room = {**room, "revision": 9, "status": "result"}

        with (
            mock.patch("group_roulette_core.repository._get_room", return_value=room),
            mock.patch(
                "group_roulette_core.repository._advance_stopping_room_to_result",
                return_value=result_room,
            ) as advance,
        ):
            result = repository.get_room_state("room_abc", member_id=None, now=now)

        advance.assert_called_once()
        self.assertEqual(result["room"]["status"], "result")
        self.assertEqual(result["room"]["revision"], 9)

    def test_repeated_request_id_returns_current_state_without_second_write(self):
        repository = importlib.import_module("group_roulette_core.repository")
        now = fixed_now()
        room = {
            "id": "GroupRouletteRoom|room_abc",
            "revision": 9,
            "status": "waiting",
            "expires_at": int((now + timedelta(hours=1)).timestamp()),
            "guest_add_enabled": True,
            "active_options": [{"id": "option_1", "label": "Pizza", "order": 1}],
            "current_spin": None,
        }
        request = repository.request_item(
            "room_abc",
            "req_add",
            member_id="member_1",
            request_type="addOption",
            payload_hash=repository.payload_hash({"label": "Pizza"}),
            now=now,
        )

        with (
            mock.patch("group_roulette_core.repository._get_room", return_value=room),
            mock.patch("group_roulette_core.repository._get_request", return_value=request),
            mock.patch("group_roulette_core.repository._write_transaction") as write_transaction,
        ):
            result = repository.add_option(
                "room_abc",
                member_id="member_1",
                request_id="req_add",
                label="Pizza",
                host_token=None,
                now=now,
            )

        write_transaction.assert_not_called()
        self.assertEqual(result["room"], room)


if __name__ == "__main__":
    unittest.main()
