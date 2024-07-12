import openpyxl
import json
import sqlite3

from collections import Counter


# TODO: add individual-table backups
def export_project_to_xlsx(c):
    """
    Exports the whole project (except for images)
    to an xlsx file using pandas and openpyxl.
    """
    tables = [el[0] for el in c.execute(
        '''
        SELECT name FROM `sqlite_master` WHERE type = "table"
        '''
    ) if el[0] != 'sqlite_sequence']
    wb = openpyxl.Workbook()
    worksheets = [wb.active]
    # Assign the name of the first table to the existing
    # worksheet and create worksheets for other tables.
    worksheets[0].title = tables[0]
    for t in tables[1:]:
        worksheets.append(wb.create_sheet(t))

    # Export all data from the tables except for columns
    # called "base64", which contain images.
    for t in tables:
        records = [row for row in c.execute(
            f'''
            SELECT * FROM {t}
            '''
        )]
        colnames = [el[0] for el in c.description]
        ws = wb[t]
        ws.append(colnames)
        for r in records:
            row = []
            for i, val in enumerate(r):
                if colnames[i] == 'base64':
                    row.append('')
                else:
                    row.append(val)
            ws.append(row)
    return wb


def get_table_as_dict(table_name, c):
    '''Returns contents of a table as a dictionary
    with `id`s for keys and { column_name : cell_value }
    dictionaries for values.'''
    results = {}
    row_iter = c.execute(f'SELECT * FROM `{table_name}`')
    column_names = [description[0] for description in c.description]
    for record in row_iter:
        results[record[0]] = {
            column_names[i]: record[i] for i in range(1, len(column_names))
        }
    return results


def get_table_ids(table_name, c):
    '''Returns a list of ids from the table.'''
    return [el[0] for el in c.execute(f'SELECT id FROM `{table_name}`')]


def get_fields_by_names(table_name, fields_arr, c):
    '''
    Returns a dictionary of dictionaries with required
    fields indexed by ids. Don't ask for id's as you'll get
    them anyway. However, ask only for id's if you don't need anything
    else. The user should check herself if the fields are actually
    present in the table.
    '''
    result = {}
    query_key = ','.join(
        f'`{el}`' for el in fields_arr
    )
    for record_id, *fields in c.execute(
        f'SELECT id,{query_key} FROM `{table_name}`'
    ):
        result[record_id] = {}
        for i, colname in enumerate(fields_arr):
            result[record_id][colname] = fields[i]
    return result


def get_value_by_id(table_name, value_id, c):
    c.execute(f'SELECT * FROM `{table_name}` WHERE id = ?',
              (value_id,))
    record = c.fetchone()
    if record is None:
        return {}
    else:
        column_names = [description[0] for description in c.description]
        return {
            column_names[i]: record[i] for i in range(1, len(column_names))
        }


def get_by_foreign_id(table_name, foreign_key, foreign_key_id, c):
    results = {}
    row_iter = c.execute(
        f'SELECT * FROM `{table_name}` WHERE `{foreign_key}` = ?',
        (foreign_key_id,))
    column_names = [description[0] for description in c.description]
    for record in row_iter:
        results[record[0]] = {
            column_names[i]: record[i] for i in range(1, len(column_names))
        }
    return results


def get_by_column_value(table_name, column_name, column_value, c):
    results = {}
    row_iter = c.execute(
        f'SELECT * FROM `{table_name}` WHERE `{column_name}` = ?',
        (column_value,))
    column_names = [description[0] for description in c.description]
    for record in row_iter:
        results[record[0]] = {
            column_names[i]: record[i] for i in range(1, len(column_names))
        }
    return results


def add_record(table_name, POST_data, conn, c):
    print('add_record')
    # pprint(POST_data)
    keys = POST_data['column_names']
    column_names = '`' + '`,`'.join(keys) + '`'
    q_marks = ','.join('?' for el in keys)
    data_tuple = tuple(POST_data['payload'][k] for k in keys)
    stmt = f'INSERT INTO `{table_name}` ({column_names}) VALUES ({q_marks})'
    # print(stmt)
    # print(data_tuple)
    c.execute(stmt, data_tuple)
    new_id = c.lastrowid
    conn.commit()
    return str(new_id)


def add_multiple_records(table_name, POST_data, conn, c):
    print('add_multiple_records')
    try:
        keys = POST_data['column_names']
        # pprint(POST_data)
        colnames = '`' + '`,`'.join(keys) + '`'
        q_marks = ','.join('?' for el in keys)
        records = []
        for value in POST_data['payload']:
            records.append(tuple(value[key] for key in keys))
        stmt = f'INSERT INTO `{table_name}` ({colnames}) VALUES ({q_marks})'
        c.executemany(stmt, records)
        # Remove possible duplicates; should've been handled differently,
        # but this needs recreating the tables now.
        # UPD: probably don't need this for now.
        # c.execute(
        #     f'''
        #     DELETE FROM `{table_name}`
        #     WHERE rowid NOT IN (
        #         SELECT MIN(rowid)
        #         FROM `{table_name}`
        #         GROUP BY {colnames}
        #     )''')
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e


# Payload must include id as the last value.
def update_record(table_name, POST_data, c, conn):
    print('update_record')
    keys = POST_data['column_names']
    # 'id' is not one of the field names
    field_names_arr = [f'`{k}` = ?' for k in keys[:-1]]
    field_names = ', '.join(field_names_arr)
    data_tuple = tuple(POST_data['payload'][key] for key in keys)
    stmt = f'UPDATE `{table_name}` SET {field_names} WHERE id = ?'
    c.execute(stmt, data_tuple)
    conn.commit()


def delete_by_id(table_name, POST_data, conn, c):
    """Delete values by id from a table.
    POST_data must contain fields 'table_name' and 'id'.
    'Raw pysqlite' analogue:
    c.execute('DELETE FROM lemmas WHERE id = ?', (POST_data['id'],))"""
    c.execute(f'DELETE FROM `{table_name}` WHERE id = ?', (POST_data['id'],))
    conn.commit()


def delete_by_foreign_key_id(table_name, POST_data, conn, c):
    print('delete_by_foreign_key_id')
    try:
        c.execute(
            f'DELETE FROM `{table_name}` WHERE `{POST_data["foreign_key"]}`=?',
            (POST_data['foreign_key_id'],))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e


# def add_by_foreign_key_id(table_name, POST_data, conn, c):
#     '''Add new values without deleting the old ones.
#     Use sparingly.'''
#     try:
#         if POST_data['payload']:
#             add_multiple_records(table_name, POST_data, conn, c)
#     except Exception as e:
#         raise e


def replace_by_foreign_key_id(table_name, POST_data, conn, c):
    '''Delete old values from a table for a given foreign key and insert new
    ones. POST_data must contain the name of the table ('table_name'),
    the name of the foreign-key field, 'foreign_key', the id for
    foreign key ('foreign_key_id').'''
    try:
        delete_by_foreign_key_id(table_name, POST_data, conn, c)
        if POST_data['payload']:
            add_multiple_records(table_name, POST_data, conn, c)
    except Exception as e:
        raise e


# Special functions we need for cases not covered by the mainstream approach


def clear_compound_ids(compound_id, c, conn):
    try:
        c.execute(
            f"""
            UPDATE tokens SET
            `is_part_of_compound` = 0,
            `compound_id` = NULL
            WHERE `compound_id` = ?
            """,
            (compound_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e


def set_compound_ids(id_pairs, c, conn):
    try:
        # See which tokens are aligned with which compounds.
        compound_id_dict = {}
        for token_id, compound_id in id_pairs:
            if compound_id not in compound_id_dict:
                compound_id_dict[compound_id] = []
            compound_id_dict[compound_id].append(token_id)

        for compound_id, token_ids in compound_id_dict.items():
            # Set compound_ids for requisite tokens.
            c.execute(
                f"""
                UPDATE tokens SET
                `is_part_of_compound` = 1,
                `compound_id` = ?
                WHERE
                id in ({','.join(str(el) for el in token_ids)})
                """,
                (compound_id,))
            # Now set compound_id's of tokens that _previously_
            # had this compound_id to null: implementation of deletion.
            c.execute(
                f"""
                UPDATE tokens SET
                `is_part_of_compound` = 0,
                `compound_id` = NULL
                WHERE
                `compound_id` = ?
                AND
                id not in ({','.join(str(el) for el in token_ids)})
                """,
                (compound_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e


def updateclfparses(POST_data, c, conn):
    try:
        # Clean up clf_parse_pics
        for clf_parse_id in c.execute(
            '''
            SELECT `id` FROM `clf_parses`
            WHERE `token_id` = ?
            ''',
            (POST_data['token_id'],)
        ):
            c.execute(
                'DELETE FROM `clf_pictures` WHERE `clf_parse_id` = ?',
                (clf_parse_id[0],))
        # Now delete old clf parses
        c.execute(
            'DELETE FROM `clf_parses` WHERE `token_id` = ?',
            (POST_data['token_id'],))
        # Go over new clf parses; add one, get the new id;
        # add the pics using the new id.
        for parse_bundle in POST_data['parse_bundles'].values():
            parse = parse_bundle['parse']
            c.execute(
                '''
                INSERT INTO `clf_parses`
                (
                    `clf_level`,
                    `clf_n`,
                    `clf_type`,
                    `comments`,
                    `false_etymology`,
                    `gardiner_number`,
                    `semantic_relation`,
                    `token_id`
                )
                VALUES (?,?,?,?,?,?,?,?)
                ''',
                (
                    parse['clf_level'],
                    parse['clf_n'],
                    parse['clf_type'],
                    parse['comments'],
                    parse['false_etymology'],
                    parse['gardiner_number'],
                    parse['semantic_relation'],
                    parse['token_id']
                ))
            new_clf_parse_id = c.lastrowid
            for pic_dict in parse_bundle['pics']:
                c.execute(
                    '''
                    INSERT INTO `clf_pictures`
                    (
                        `clf_parse_id`,
                        `base64`,
                        `coords`,
                        `comments`,
                        `witness_picture_id`
                    )
                    VALUES (?,?,?,?,?)
                    ''',
                    (
                        new_clf_parse_id,
                        pic_dict['base64'],
                        pic_dict['coords'],
                        pic_dict['comments'],
                        pic_dict['witness_picture_id']
                    ))
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e


def get_stats(cursor):
    num_lemmas = cursor.execute(
        'SELECT COUNT(`id`) FROM `lemmas`'
    ).fetchone()[0]
    num_tokens = cursor.execute(
        'SELECT COUNT(`id`) FROM `tokens`'
    ).fetchone()[0]

    clf_counter_by_token = Counter()
    token_counter_by_clf_number = Counter()
    for row in cursor.execute("SELECT `token_id` FROM `clf_parses`"):
        clf_counter_by_token[row[0]] += 1
    for clf_count in clf_counter_by_token.values():
        token_counter_by_clf_number[clf_count] += 1
    return {
        'lemmas': num_lemmas,
        'tokens': num_tokens,
        'tokens_by_clf_number': token_counter_by_clf_number
    }


def add_tokens_to_witness(conn,
                          cursor,
                          witness_id,
                          tokens_arr,
                          store_coordinates):
    records = []
    try:
        if store_coordinates:
            for token in tokens_arr:
                records.append((
                    token['token'].replace('~', ''),
                    token['token'],
                    witness_id,
                    token['coord'],
                    0)) # is_part_of_compound
            cursor.executemany(
                '''
                INSERT INTO tokens (`mdc`,
                                    `mdc_w_markup`,
                                    `witness_id`,
                                    `coordinates_in_witness`,
                                    `is_part_of_compound`)
                VALUES (?,?,?,?,?)
                ''',
                records)
        else:
            for token in tokens_arr:
                records.append((
                    token['token'].replace('~', ''),
                    token['token'],
                    witness_id,
                    0)) # is_part_of_compound
            cursor.executemany(
                '''
                INSERT INTO tokens (`mdc`,
                                    `mdc_w_markup`,
                                    `witness_id`,
                                    `is_part_of_compound`)
                VALUES (?,?,?,?)
                ''',
                records)
        conn.commit()
    except:
        conn.rollback()
        raise


def id_exists(table_name, idx, conn: sqlite3.Connection):
    return conn.cursor().execute(
        f'SELECT SUM(1) FROM {table_name} WHERE id = {idx}'
    ).fetchone()[0] is not None


def purge_dead_records(conn: sqlite3.Connection, c: sqlite3.Cursor):
    '''
    Uses the list of necessary foreign keys from keys_for_purging.json
    to delete all the meaningless records with dead foreign keys.
    '''
    with open('keys_for_purging.json', 'r', encoding='utf-8') as inp:
        keys_for_purging = json.load(inp)
    for table_name, key_arr in keys_for_purging.items():
        kill_list = set()
        for key_name, foreign_table in key_arr:
            for idx, key_val in c.execute(
                    f'SELECT id, `{key_name}` FROM `{table_name}`'
                    ):
                if key_val is None or key_val == '':
                    print(
                        f'Foreign key {key_name} in record {idx} '
                        f'in table {table_name} has a null value'
                    )
                    kill_list.add(idx)
                elif not id_exists(foreign_table, key_val, conn):
                    print(
                        f'Foreign key {key_name} in record {idx} '
                        f'in table {table_name} has a missing value {key_val}'
                    )
                    kill_list.add(idx)
        if kill_list:
            c.execute(f'DELETE FROM {table_name} WHERE id IN ({", ".join(str(el) for el in kill_list)})')
            print(f'Purged {len(kill_list)} records from {table_name}')

