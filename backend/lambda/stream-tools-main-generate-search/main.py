import decimal
import json

import boto3


def get_dynamodb_table(table):
    return boto3.resource("dynamodb").Table(table)


def json_decimal_default_proc(obj):
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    raise TypeError


def ex(x, elem_name=None):
    dot_b = None
    if elem_name is not None:
        if "." in elem_name:
            dot_a, dot_b = elem_name.split(".")
            print(elem_name, x, dot_a, dot_b)
            elem = x.get(dot_a)
        else:
            elem = x.get(elem_name, {})
    else:
        elem = x

    if elem is None:
        return None
    if "S" in elem:
        return elem["S"]
    if "N" in elem:
        return decimal.Decimal(elem["N"])
    if "BOOL" in elem:
        return elem["BOOL"]
    if "M" in elem:
        result = {k: ex(v) for k, v in elem["M"].items()}
        if dot_b is not None:
            return result.get(dot_b)
        else:
            return result
    if "L" in elem:
        return [ex(el) for el in elem["L"]]
    return None


def to_str(item, default=None):
    item_default = item
    if item_default is None:
        item_default = default
    return str(item_default)


def ex_wrap(item, key_column):
    if key_column == "key":
        return ex(item, key_column).split("|")[1]
    else:
        return ex(item, key_column)


def gen(item, event_name, key, record_type_def, elems=[], context=None):
    where = None

    record_type = record_type_def[0]
    record_type_replacement = record_type_def[1] if len(record_type_def) == 2 else None

    sp = record_type.split("|")
    if len(sp) >= 3:
        where = sp[2]
    key_type, datas_str = sp[0], sp[1]

    search_item_key = key
    key_columns_text = None
    if "#" in key_type:
        key_type, key_columns_text = key_type.split("#")

    if key_type != key.split("|")[0]:
        return None

    if key_columns_text is not None:
        key_columns = key_columns_text.split("&")
        k_tmp = [ex_wrap(item, key_column) for key_column in key_columns]
        k = "&".join([x for x in k_tmp if x is not None])
        search_item_key = f"{key_type}#{key_columns_text}|{k}"

    datas_default = None
    if "#" in datas_str:
        datas_str, datas_default = datas_str.split("#")

    if where is not None:
        conds = where.split("&")
        for cond in conds:
            if "=" in cond:
                k, v = cond.split("=")
                if str(ex(item, k)) != v:
                    return None
            elif "<>" in cond:
                k, v = cond.split("<>")
                if str(ex(item, k)) == v:
                    return None
            elif "is not null" in cond:
                if ex(item, cond.replace("is not null", "").strip()) is None:
                    return None
            elif cond == "do not delete":
                if context == "DELETE":
                    return None

    ret = {
        "eventName": event_name,
        "key": search_item_key,
        "recordType": record_type
        if record_type_replacement is None
        else record_type_replacement,
        "data": "&".join(
            [to_str(ex(item, data), datas_default) for data in datas_str.split("&")]
        ),
    }
    for name in elems:
        if isinstance(elems, list):
            dot_b = None
            if "." in name:
                dot_a, dot_b = name.split(".")
                if dot_a not in ret:
                    ret[dot_a] = {}
                ret[dot_a][dot_b] = ex(item, name)
            else:
                ret[name] = ex(item, name)
        elif isinstance(elems, dict):
            ret[elems[name]] = ex(item, name)
    print("ret", ret)
    return ret


def main(event, context, retroact=False):
    config_file = "config.development.json"
    if context.function_name == "stream-bodydesign-main-generate-search":
        config_file = "config.production.json"
    with open(config_file, "r") as config_json:
        c = json.load(config_json)

    print(event, context)
    put_items = []
    delete_items = []
    for ev in event.get("Records", []):
        event_name = ev.get("eventName")
        ddb = ev.get("dynamodb", {})
        key = ddb.get("Keys", {}).get("key", {}).get("S")
        new_image = ddb.get("NewImage", {})
        old_image = ddb.get("OldImage", {})

        params_list = []

        for params in params_list:
            if event_name in ("REMOVE", "MODIFY"):
                g = gen(old_image, event_name, key, *params, context="DELETE")
                if g is not None:
                    delete_items.append(g)
            if event_name in ("INSERT", "MODIFY"):
                g = gen(new_image, event_name, key, *params, context="PUT")
                if g is not None:
                    put_items.append(g)

    if len(put_items) <= 0 and len(delete_items) <= 0:
        return

    table = get_dynamodb_table(c["search_table"])

    for item in delete_items:
        try:
            table.delete_item(
                Key={"key": item["key"], "recordType": item["recordType"]}
            )
            k, r = item.pop("key"), item.pop("recordType")
        except Exception as e:
            print(e, item)

    putted_items = []  # 遡及で使う
    for item in put_items:
        try:
            table.put_item(Item=item)
            k, r = item.pop("key"), item.pop("recordType")
            if retroact:
                putted_items.append((k, r))
        except Exception as e:
            print(e, item)

    if retroact:
        return putted_items
