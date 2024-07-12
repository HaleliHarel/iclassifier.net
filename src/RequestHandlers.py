import json
import sqlite3
from datetime import date

from flask import make_response, jsonify, send_file
from tempfile import NamedTemporaryFile

import TableProcessing as TP


#
# Helpers
#


def get_tokens_for_clf(clf, c):
    result = {}
    for item in c.execute("""
        SELECT tokens.id,                 -- 0
               -- tokens.lemma_id,           
               -- is_part_of_compound,   
               -- compound_id,           
               -- super_text_id,        
               -- coordinates_in_txt,    
               tokens.textual_source,     -- 1 TODO: convert text to ids
               -- coordinates_in_ts,     
               -- mdc,                   
               tokens.mdc_w_markup,       -- 2
               -- classification_status, 
               -- sign_comments,         
               -- context_meaning,       
               tokens.syntactic_relation, -- 3
               tokens.pos,                -- 4
               -- tokens.register,        
               -- tokens.comments,        
               lemmas.transliteration,    -- 5
               lemmas.meaning             -- 6
        FROM tokens INNER JOIN lemmas WHERE tokens.lemma_id = lemmas.id"""):
        if '~%s~' % clf in item[2]:
            result[item[0]] = {
                'textual_source': item[1],
                'mdc_w_markup': item[2],
                'syntactic_relation': item[3],
                'pos': item[4],
                'lemma': item[5],
                'lemma_meaning': item[6]
            }
    return result


def populate_headers_basic(resp):
    """Restricts access to iclassifier.pw; allows cookies.
    Should not be used in the code itself, consider using one of
    populate_headers_TYPE functions."""
    # resp.headers['Access-Control-Allow-Origin'] = 'https://www.iclassifier.pw'
    resp.headers['Access-Control-Allow-Origin'] = '*'
    resp.headers['Access-Control-Allow-Credentials'] = 'true'


def populate_headers_json(resp):
    resp.headers['Content-Type'] = 'application/json'
    populate_headers_basic(resp)


def populate_headers_plain(resp):
    resp.headers['Content-Type'] = 'text/plain'
    populate_headers_basic(resp)


def list_to_keys(str_list):
    return ','.join(f"`{el}`" for el in str_list)


def description_to_data(descr_dict, include_id=False, item_id=None):
    result = {}
    result['payload'] = descr_dict
    result['column_names'] = list(descr_dict)
    if include_id:
        result['column_names'].append('id')
        result['payload']['id'] = item_id
    return result


#
# Pre-baked responses
#

def no_write_access(app):
    with app.app_context():
        resp = make_response('User does not have writing access', 401)
    populate_headers_plain(resp)
    return resp


def update_successful(app):
    print('update_successful')
    with app.app_context():
        resp = make_response('Update successful', 200)
    populate_headers_plain(resp)
    return resp

#
# Request handlers
#

### Request handlers for open projects. ###


def readonly_get_all(app, table_name, c):
    with app.app_context():
        resp = make_response(
            jsonify(TP.get_table_as_dict(table_name, c)),
            200
        )
    populate_headers_json(resp)
    return resp


def readonly_byid(app, request, table_name, c):
    query_dict = dict(**request.args)
    if 'id' not in query_dict:
        with app.app_context():
            resp = make_response('No id given', 400)
        populate_headers_plain(resp)
        return resp
    with app.app_context():
        resp = make_response(
            jsonify(
                TP.get_value_by_id(
                    table_name,
                    query_dict['id'],
                    c)),
            200)
    populate_headers_json(resp)
    return resp


def readonly_byforeignid(app, request, table_name, c):
    query_dict = dict(**request.args)
    if 'foreign_key' not in query_dict or \
            'foreign_key_id' not in query_dict:
        with app.app_context():
            resp = make_response('Foreign key values underspecified', 400)
        populate_headers_plain(resp)
        return resp
    with app.app_context():
        resp = make_response(
            jsonify(
                TP.get_by_foreign_id(
                    table_name,
                    query_dict['foreign_key'],
                    query_dict['foreign_key_id'],
                    c)),
            200)
    populate_headers_json(resp)
    return resp


def readonly_clfreport(app, request, c):
    query_dict = dict(**request.args)
    # pprint(truncate_long_lines(query_dict), compact=True)
    if 'mdc' not in query_dict:
        with app.app_context():
            resp = make_response('No MDC provided', 400)
        populate_headers_plain(resp)
        return resp
    with app.app_context():
        resp = make_response(
            jsonify(
                get_tokens_for_clf(query_dict['mdc'][0], c)),
            200)
    populate_headers_json(resp)
    return resp


### Private-request handlers ###

def getxlsx(app, project_name, c):
    with NamedTemporaryFile() as tmp:
        wb = TP.export_project_to_xlsx(c)
        wb.save(tmp.name)
        tmp.seek(0)
        with app.app_context():
            resp = make_response(
                send_file(
                    tmp.name,
                    as_attachment=True,
                    attachment_filename=f'{project_name}-' +
                    f'{date.isoformat(date.today())}.xlsx'))
        return resp


def get_all(app, table_name, c):
    with app.app_context():
        resp = make_response(
            jsonify(TP.get_table_as_dict(table_name, c)),
            200
        )
    populate_headers_json(resp)
    return resp


def get_ids(app, table_name, c):
    with app.app_context():
        resp = make_response(
            jsonify(TP.get_table_ids(table_name, c)),
            200
        )
    populate_headers_json(resp)
    return resp


def byid(app, request, table_name, c):
    query_dict = dict(**request.args)
    # pprint(query_dict)
    if 'id' not in query_dict:
        with app.app_context():
            resp = make_response('No id given', 400)
        populate_headers_plain(resp)
        return resp
    with app.app_context():
        resp = make_response(
            jsonify(
                TP.get_value_by_id(
                    table_name,
                    query_dict['id'],
                    c)),
            200)
    populate_headers_json(resp)
    return resp


def byforeignid(app, request, table_name, c):
    query_dict = dict(**request.args)
    # pprint(truncate_long_lines(query_dict), compact=True)
    if 'foreign_key' not in query_dict or \
            'foreign_key_id' not in query_dict:
        with app.app_context():
            resp = make_response('Foreign key values underspecified', 400)
        populate_headers_plain(resp)
        return resp
    with app.app_context():
        resp = make_response(
            jsonify(
                TP.get_by_foreign_id(
                    table_name,
                    query_dict['foreign_key'],
                    query_dict['foreign_key_id'],
                    c)),
            200)
    populate_headers_json(resp)
    return resp


def bycolumnname(app, request, table_name, c):
    query_dict = dict(**request.args)
    # pprint(truncate_long_lines(query_dict), compact=True)
    with app.app_context():
        resp = make_response(
            jsonify(
                TP.get_fields_by_names(
                    table_name,
                    list(query_dict.keys()),
                    c)))
    populate_headers_json(resp)
    return resp


def clfreport(app, request, c):
    query_dict = dict(**request.args)
    # pprint(truncate_long_lines(query_dict), compact=True)
    if 'mdc' not in query_dict:
        with app.app_context():
            resp = make_response('No MDC provided', 400)
        populate_headers_plain(resp)
        return resp
    with app.app_context():
        resp = make_response(
            jsonify(
                get_tokens_for_clf(query_dict['mdc'][0], c)),
            200)
    populate_headers_json(resp)
    return resp


def add_record(app, access, request, table_name, conn, c):
    if access != 'write':
        return no_write_access(app)
    # We send json as 'text/plain' in order
    # not to deal with preflight.
    POST_data = json.loads(request.data)
    new_id = TP.add_record(table_name, POST_data, conn, c)
    with app.app_context():
        resp = make_response(new_id, 200)
    populate_headers_plain(resp)
    return resp


###########
# New API #
###########


### Additions ###


def update_compound_elements(compound_id, token_ids, conn, c):
    c.execute(
        f'''
            UPDATE tokens
            SET `compound_id` = ?
            WHERE id IN ({', '.join(str(el) for el in token_ids)})
            ''',
        (compound_id,))
    # Remove all spurious links to this compound.
    c.execute(
        f'''
            UPDATE tokens
            SET `compound_id` = null
            WHERE
                `compound_id` = ?
                AND
                id NOT IN ({', '.join(str(el) for el in token_ids)})
            ''',
        (compound_id,))
    conn.commit()


def normalise_token_biblio(token_biblio):
    return {
        'id': token_biblio['id'],
        'token_id': token_biblio['token_id'],
        'publication_id': token_biblio['source_id'],
        'page_n': token_biblio['pages'],
        'comments': token_biblio['comments']
    }


# TODO: remove code duplication by moving
# the addition of supplementary data
# to a separate function.
def holisticadd_token(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)

    POST_data = json.loads(request.data)
    token_id = POST_data['id']
    description = POST_data['description']

    if token_id is None:
        # We add
        try:
            # Add basic token info
            data_dict = description_to_data(description)
            new_id = TP.add_record('tokens', data_dict, conn, c)
            # Update compound info
            update_compound_elements(new_id,
                                     POST_data['compound_elements'],
                                     conn, c)
            # Add classifier parses
            for clf_parse in POST_data['clfParses']:
                data_dict = description_to_data(clf_parse['description'])
                data_dict['payload']['token_id'] = new_id
                new_clf_id = TP.add_record('clf_parses', data_dict, conn, c)
                # Add classifier pictures
                for clf_pic_data in clf_parse['pictures']:
                    del clf_pic_data['id']
                    data_dict = description_to_data(clf_pic_data)
                    data_dict['payload']['clf_parse_id'] = new_clf_id
                    data_dict['payload']['coords'] = json.dumps(
                        data_dict['payload']['coords'])
                    TP.add_record('clf_pictures', data_dict, conn, c)
            # Add token pictures
            for token_pic_data in POST_data['token_pictures']:
                del token_pic_data['id']
                data_dict = description_to_data(token_pic_data)
                data_dict['payload']['token_id'] = new_id
                data_dict['payload']['coords'] = json.dumps(
                    data_dict['payload']['coords'])
                TP.add_record('token_pictures', data_dict, conn, c)
            # Add biblio references
            for biblio_data in POST_data['biblio_refs']:
                biblio_data_norm = normalise_token_biblio(biblio_data)
                del biblio_data_norm['id']
                data_dict = description_to_data(biblio_data_norm)
                data_dict['payload']['token_id'] = new_id
                TP.add_record('token_biblio', data_dict, conn, c)

            with app.app_context():
                resp = make_response(new_id, 200)
            populate_headers_plain(resp)
            return resp
        except sqlite3.Error as e:
            print(f'Database error: {e}')
            return None
        except Exception as e:
            print(f'Exception: {e}')
            return None
    else:
        # We update
        try:
            # Update basic token info
            print('Basic info')
            data_dict = description_to_data(description,
                                            include_id=True,
                                            item_id=token_id)
            TP.update_record('tokens', data_dict, c, conn)
            # Update compound info
            print('Compound elements')
            update_compound_elements(token_id,
                                     POST_data['compound_elements'],
                                     conn, c)
            # Do the same thing as before but first overwrite old records.
            # Remove/add classifier parses
            TP.delete_by_foreign_key_id(
                'clf_parses',
                {'foreign_key': 'token_id', 'foreign_key_id': token_id},
                conn, c)
            for clf_parse in POST_data['clfParses']:
                print('CLF parse')
                data_dict = description_to_data(clf_parse['description'])
                data_dict['payload']['token_id'] = token_id
                new_clf_id = TP.add_record('clf_parses', data_dict, conn, c)
                # Add new classifier pictures. Old ones
                # were orphaned and will be purged later.
                for clf_pic_data in clf_parse['pictures']:
                    print('CLF pic')
                    del clf_pic_data['id']
                    data_dict = description_to_data(clf_pic_data)
                    data_dict['payload']['clf_parse_id'] = new_clf_id
                    data_dict['payload']['coords'] = json.dumps(
                        data_dict['payload']['coords'])
                    TP.add_record('clf_pictures', data_dict, conn, c)
            # Remove/add token pictures
            print('Token pics')
            TP.delete_by_foreign_key_id(
                'token_pictures',
                {'foreign_key': 'token_id', 'foreign_key_id': token_id},
                conn, c)
            for token_pic_data in POST_data['token_pictures']:
                del token_pic_data['id']
                data_dict = description_to_data(token_pic_data)
                data_dict['payload']['token_id'] = token_id
                data_dict['payload']['coords'] = json.dumps(
                    data_dict['payload']['coords'])
                TP.add_record('token_pictures', data_dict, conn, c)
            # Remove/add biblio references
            print('Biblio refs')
            TP.delete_by_foreign_key_id(
                'token_biblio',
                {'foreign_key': 'token_id', 'foreign_key_id': token_id},
                conn, c)
            for biblio_data in POST_data['biblio_refs']:
                biblio_data_norm = normalise_token_biblio(biblio_data)
                del biblio_data_norm['id']
                data_dict = description_to_data(biblio_data_norm)
                data_dict['payload']['token_id'] = token_id
                TP.add_record('token_biblio', data_dict, conn, c)

            # Purge orphaned auxiliary records, first of all old
            # classifier pictures.
            TP.purge_dead_records(conn, c)
            return update_successful(app)

        except sqlite3.Error as e:
            print(f'Database error: {e}')
            return None
        except Exception as e:
            print(f'Exception: {e}')
            return None


def holisticadd_witness(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)

    POST_data = json.loads(request.data)
    witness_id = POST_data['id']
    description = POST_data['description']

    if witness_id is None:
        try:
            # Add basic info
            new_id = TP.add_record(
                'witnesses',
                description_to_data(description),
                conn, c)

            # Add biblio refs
            for biblio_data in POST_data['biblio_refs']:
                biblio_data_norm = {
                    'witness_id': new_id,
                    'publication_id': biblio_data['description']['publication_id'],
                    'page_n': biblio_data['description']['page_n'],
                    'comments': biblio_data['description']['comments']
                }
                data_dict = description_to_data(biblio_data_norm)
                TP.add_record('witness_biblio', data_dict, conn, c)

            # Add pictures
            for pic_data in POST_data['pictures']:
                pic_data_norm = {
                    'witness_id': new_id,
                    'base64': pic_data['description']['base64'],
                    'comments': pic_data['description']['comments'],
                    'title': pic_data['description']['title']
                }
                data_dict = description_to_data(pic_data_norm)
                TP.add_record('witness_pictures', data_dict, conn, c)

            with app.app_context():
                resp = make_response(new_id, 200)
                populate_headers_plain(resp)
                return resp
        except sqlite3.Error as e:
            print(f'Database error: {e}')
            return None
        except Exception as e:
            print(f'Exception: {e}')
            return None
    else:
        try:
            data_dict = description_to_data(
                description,
                include_id=True,
                item_id=witness_id)
            TP.update_record('witnesses', data_dict, c, conn)

            # Biblio refs
            TP.delete_by_foreign_key_id(
                'witness_biblio',
                {
                    'foreign_key': 'witness_id',
                    'foreign_key_id': witness_id
                },
                conn, c)
            for biblio_data in POST_data['biblio_refs']:
                biblio_data_norm = {
                    'witness_id': witness_id,
                    'publication_id': biblio_data['description']['publication_id'],
                    'page_n': biblio_data['description']['page_n'],
                    'comments': biblio_data['description']['comments']
                }
                data_dict = description_to_data(biblio_data_norm)
                TP.add_record('witness_biblio', data_dict, conn, c)

            # Pictures
            TP.delete_by_foreign_key_id(
                'witness_pictures',
                {
                    'foreign_key': 'witness_id',
                    'foreign_key_id': witness_id
                },
                conn, c)
            for pic_data in POST_data['pictures']:
                pic_data_norm = {
                    'witness_id': witness_id,
                    'base64': pic_data['description']['base64'],
                    'comments': pic_data['description']['comments'],
                    'title': pic_data['description']['title']
                }
                data_dict = description_to_data(pic_data_norm)
                TP.add_record('witness_pictures', data_dict, conn, c)

            return update_successful(app)
        except sqlite3.Error as e:
            print(f'Database error: {e}')
            return None
        except Exception as e:
            print(f'Exception: {e}')
            return None


def holisticadd_supertext(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)

    POST_data = json.loads(request.data)
    supertext_id = POST_data['id']
    description = POST_data['description']

    if supertext_id is None:
        try:
            # Add basic info
            data_dict = {
                'text_name': description['text_name'],
                'comments': description['comments']
            }
            new_id = TP.add_record(
                'texts',
                description_to_data(data_dict),
                conn, c)

            # Add biblio refs
            for biblio_data in POST_data['biblio_refs']:
                biblio_data_norm = {
                    'text_id': new_id,
                    'publication_id': biblio_data['publication_id'],
                    'page_n': biblio_data['page_n'],
                    'comments': biblio_data['comments']
                }
                data_dict = description_to_data(biblio_data_norm)
                TP.add_record('text_biblio', data_dict, conn, c)

            with app.app_context():
                resp = make_response(new_id, 200)
                populate_headers_plain(resp)
                return resp
        except sqlite3.Error as e:
            print(f'Database error: {e}')
            return None
        except Exception as e:
            print(f'Exception: {e}')
            return None
    else:
        try:
            data_dict = description_to_data(
                description,
                include_id=True,
                item_id=supertext_id)
            TP.update_record('texts', data_dict, c, conn)

            # Biblio refs
            TP.delete_by_foreign_key_id(
                'text_biblio',
                {
                    'foreign_key': 'text_id',
                    'foreign_key_id': supertext_id
                },
                conn, c)
            for biblio_data in POST_data['biblio_refs']:
                biblio_data_norm = {
                    'text_id': supertext_id,
                    'publication_id': biblio_data['publication_id'],
                    'page_n': biblio_data['page_n'],
                    'comments': biblio_data['comments']
                }
                data_dict = description_to_data(biblio_data_norm)
                TP.add_record('text_biblio', data_dict, conn, c)

            return update_successful(app)
        except sqlite3.Error as e:
            print(f'Database error: {e}')
            return None
        except Exception as e:
            print(f'Exception: {e}')
            return None


def holisticadd_lemmas(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)

    POST_data = json.loads(request.data)
    lemma_id = POST_data['id']
    add_lemma_with_id = POST_data['add_lemma_with_id'] == 1
    description = POST_data['description']

    if lemma_id is None or add_lemma_with_id:
        try:
            # Add basic info and obtain an ID,
            # then add supplementary data.
            if lemma_id is None:
                new_id = TP.add_record(
                    'lemmas',
                    description_to_data(description),
                    conn, c)
            else:
                new_id = TP.add_record(
                    'lemmas',
                    description_to_data(
                        description, include_id=True, item_id=lemma_id),
                    conn, c)

            add_supplementary_data_lemmas(POST_data, new_id, conn, c)
            with app.app_context():
                resp = make_response(new_id, 200)
                populate_headers_plain(resp)
                return resp
        except sqlite3.Error as e:
            print(f'Database error: {e}')
            return None
        except Exception as e:
            print(f'Exception: {e}')
            return None
    else:
        try:
            # Update basic info, then delete
            # and re-add supplementary data.
            data_dict = description_to_data(
                description,
                include_id=True,
                item_id=lemma_id)
            TP.update_record('lemmas', data_dict, c, conn)
            for table_name in [
                'lemma_other_languages',
                'lemma_other_languages_lexicon_entries',
                'lemma_cognates',
                'lemma_variants'
            ]:
                TP.delete_by_foreign_key_id(
                    table_name,
                    {'foreign_key': 'lemma_id', 'foreign_key_id': lemma_id},
                    conn, c)
            add_supplementary_data_lemmas(POST_data, lemma_id, conn, c)
            return update_successful(app)
        except sqlite3.Error as e:
            print(f'Database error: {e}')
            return None
        except Exception as e:
            print(f'Exception: {e}')
            return None


def add_supplementary_data_lemmas(POST_data, lemma_id, conn, c):
    print('add_supplementary_data_lemmas')
    # Add biblio refs; the table has a weird name
    # for historical reasons.
    print('Adding biblio refs')
    for biblio_data in POST_data['biblio_refs']:
        biblio_data['description']['lemma_id'] = lemma_id
        TP.add_record(
            'lemma_other_languages_lexicon_entries',
            description_to_data(biblio_data['description']),
            conn, c)

    # Add cognates
    print('Adding cognates')
    for cognate_data in POST_data['cognates']:
        cognate_data['description']['lemma_id'] = lemma_id
        TP.add_record(
            'lemma_cognates',
            description_to_data(cognate_data['description']),
            conn, c)

    # Add borrowing_info; borrowing info is a dict, not an array
    print('Adding borrowing info')
    borrowing_data = POST_data['borrowing_info']['description']
    # Only add if not empty
    for v in borrowing_data.values():
        if v is not None:
            borrowing_data['lemma_id'] = lemma_id
            TP.add_record(
                'lemma_other_languages',
                description_to_data(borrowing_data),
                conn, c)
            break

    # Add variants
    print('Adding variants')
    for variant_data in POST_data['variants']:
        variant_data['description']['lemma_id'] = lemma_id
        TP.add_record(
            'lemma_variants',
            description_to_data(variant_data['description']),
            conn, c)


### Deletions ###

def holisticdel_token(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)

    POST_data = json.loads(request.data)
    token_id = POST_data['id']

    try:
        # Delete clf parses and associated pictures
        for clf_parse_id, in c.execute(
                'SELECT id FROM `clf_parses` WHERE `token_id` = ?',
                (token_id,)):
            TP.delete_by_foreign_key_id(
                'clf_pictures',
                {'foreign_key': 'clf_parse_id', 'foreign_key_id': clf_parse_id},
                conn, c)
            TP.delete_by_id('clf_parses', {'id': clf_parse_id}, conn, c)
        # Delete biblio references
        TP.delete_by_foreign_key_id(
            'token_biblio',
            {'foreign_key': 'token_id', 'foreign_key_id': token_id},
            conn, c)
        # Delete token pictures
        TP.delete_by_foreign_key_id(
            'token_pictures',
            {'foreign_key': 'token_id', 'foreign_key_id': token_id},
            conn, c)
        # Orphan compound elements
        update_compound_elements(token_id, [], conn, c)
        # Remove the token
        TP.delete_by_id('tokens', {'id': token_id}, conn, c)
        return update_successful(app)
    except sqlite3.Error as e:
        print(f'Database error: {e}')
        return None
    except Exception as e:
        print(f'Exception: {e}')
        return None


def holisticdel_supertext(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)

    POST_data = json.loads(request.data)
    supertext_id = POST_data['id']

    try:
        # Delete biblio references
        TP.delete_by_foreign_key_id(
            'text_biblio',
            {'foreign_key': 'text_id', 'foreign_key_id': supertext_id},
            conn, c)
        TP.delete_by_id('texts', {'id': supertext_id}, conn, c)
        return update_successful(app)
    except sqlite3.Error as e:
        print(f'Database error: {e}')
        return None
    except Exception as e:
        print(f'Exception: {e}')
        return None


def holisticdel_witness(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)

    POST_data = json.loads(request.data)
    witness_id = POST_data['id']

    try:
        # Delete biblio references
        TP.delete_by_foreign_key_id(
            'witness_biblio',
            {'foreign_key': 'witness_id', 'foreign_key_id': witness_id},
            conn, c)
        # Delete pictures
        TP.delete_by_foreign_key_id(
            'witness_pictures',
            {'foreign_key': 'witness_id', 'foreign_key_id': witness_id},
            conn, c)
        TP.delete_by_id('witnesses', {'id': witness_id}, conn, c)
        return update_successful(app)
    except sqlite3.Error as e:
        print(f'Database error: {e}')
        return None
    except Exception as e:
        print(f'Exception: {e}')
        return None


def holisticdel_lemma(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)

    POST_data = json.loads(request.data)
    lemma_id = POST_data['id']
    try:
        for table_name in [
            'lemma_other_languages',
            'lemma_other_languages_lexicon_entries',
            'lemma_cognates',
            'lemma_variants'
        ]:
            TP.delete_by_foreign_key_id(
                table_name,
                {'foreign_key': 'lemma_id', 'foreign_key_id': lemma_id},
                conn, c)
        TP.delete_by_id('lemmas', {'id': lemma_id}, conn, c)
        return update_successful(app)
    except sqlite3.Error as e:
        print(f'Database error: {e}')
        return None
    except Exception as e:
        print(f'Exception: {e}')
        return None


### Other stuff ###


def addmultiple(app, access, request, table_name, conn, c):
    if access != 'write':
        return no_write_access(app)
    POST_data = json.loads(request.data)
    TP.add_multiple_records(table_name, POST_data, conn, c)
    return update_successful(app)


def updaterecord(app, access, request, table_name, conn, c):
    if access != 'write':
        return no_write_access(app)
    POST_data = json.loads(request.data)
    # pprint(truncate_long_lines(POST_data), compact=True)
    TP.update_record(table_name, POST_data, c, conn)
    return update_successful(app)


def updateclfparses(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)
    # A special custom action needed to
    # preserve the connection between clf_parses
    # and pictures associated with them.
    POST_data = json.loads(request.data)
    # pprint(truncate_long_lines(POST_data), compact=True)
    TP.updateclfparses(POST_data, c, conn)
    return update_successful(app)


def deletebyid(app, access, request, table_name, conn, c):
    if access != 'write':
        return no_write_access(app)
    POST_data = json.loads(request.data)
    TP.delete_by_id(table_name, POST_data, conn, c)
    return update_successful(app)


def deletebyidmultiple(app, access, request, table_name, conn, c):
    if access != 'write':
        return no_write_access(app)
    POST_data = json.loads(request.data)
    for row_id in POST_data['ids']:
        TP.delete_by_id(
            table_name,
            {'id': row_id},
            conn,
            c
        )
    return update_successful(app)


def deletebyforeignkey(app, access, request, table_name, conn, c):
    if access != 'write':
        return no_write_access(app)
    POST_data = json.loads(request.data)
    TP.delete_by_foreign_key_id(table_name, POST_data, conn, c)
    return update_successful(app)


def replacebyforeignkey(app, access, request, table_name, conn, c):
    if access != 'write':
        return no_write_access(app)
    POST_data = json.loads(request.data)
    TP.replace_by_foreign_key_id(table_name, POST_data, conn, c)
    return update_successful(app)


def clearcompoundids(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)
    POST_data = json.loads(request.data)
    TP.clear_compound_ids(POST_data['compound_id'], c, conn)
    return update_successful(app)


def setcompoundids(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)
    POST_data = json.loads(request.data)
    TP.set_compound_ids(POST_data, c, conn)
    return update_successful(app)


def addtokenstowitness(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)
    POST_data = json.loads(request.data)
    TP.add_tokens_to_witness(conn,
                             c,
                             POST_data['witness_id'],
                             POST_data['tokens'],
                             POST_data['store_coordinates'])
    return update_successful(app)


def addclfannotations(app, access, request, conn, c):
    if access != 'write':
        return no_write_access(app)

    try:
        POST_data = json.loads(request.data)
    except json.decoder.JSONDecodeError as e:
        resp = make_response(f'Malformed JSON: {e}', 500)
        populate_headers_plain(resp)
        return resp

    try:
        # Update the comment
        comment = POST_data['description']['comment']
        clf = POST_data['description']['clf']
        c.execute('DELETE FROM `clf_comments` WHERE `clf` = ?', (clf,))
        if comment is not None and comment != '':
            c.execute(
                'INSERT INTO `clf_comments` (`clf`,`comment`) VALUES (?,?)',
                (clf, comment))

        # Update the meanings
        c.execute('DELETE FROM `clf_meanings` WHERE `clf` = ?', (clf,))
        for meaning_dict in POST_data['meanings']:
            descr = meaning_dict['description']
            if descr['meaning'] is not None and descr['meaning'] != '':
                c.execute(
                    'INSERT INTO `clf_meanings` (`clf`,`meaning`,`source_id`,`source_pages`) VALUES (?,?,?,?)',
                    (descr['clf'], descr['meaning'], descr['source_id'], descr['source_pages']))
        
        conn.commit()
        return update_successful(app)
    except Exception as e:
        resp = make_response(f'An error has occurred: {e}', 500)
        populate_headers_plain(resp)
        return resp
    

# Presumably unneeded code

#    elif action == 'bycolumnvalue':
#        query_dict = dict(**request.args)
#        pprint(truncate_long_lines(query_dict), compact=True)
#        if 'column_name' not in query_dict or \
#                'column_value' not in query_dict:
#            resp = make_response('Column name or value not specified', 400)
#            populate_headers_plain(resp)
#            return resp
#        resp = make_response(
#            jsonify(
#                TP.get_by_column_value(table_name,
#                                       query_dict['column_name'],
#                                       query_dict['column_value'],
#                                       c)),
#            200)
#        populate_headers_json(resp)
#        return resp
