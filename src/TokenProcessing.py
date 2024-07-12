import json

from CLFProcessing import update_clfs_for_token
from BiblioProcessing import update_biblio_for_token
from BackupHandling import extract_table

extract_token_table = lambda c: extract_table('tokens', c)


def get_token_list(c):
    result = {}
    for item in c.execute("""
        SELECT id,                    -- 0
               lemma_id,              -- 1
               is_part_of_compound,   -- 2
               compound_id,           -- 3
               super_text_id,         -- 4
               coordinates_in_txt,    -- 5
               textual_source,        -- 6 TODO: convert text to ids
               coordinates_in_ts,     -- 7
               mdc,                   -- 8
               mdc_w_markup,          -- 9
               classification_status, -- 10
               sign_comments,         -- 11
               context_meaning,       -- 12
               syntactic_relation,    -- 13
               pos,                   -- 14
               register,              -- 15
               comments               -- 16
        FROM tokens"""):
        result[item[0]] = {
            'lemma_id': item[1],
            'is_part_of_compound': item[2],
            'compound_id': item[3],
            'super_text_id': item[4],
            'coordinates_in_txt': item[5],
            'textual_source_id': item[6],
            'coordinates_in_ts': item[7],
            'mdc': item[8],
            'mdc_w_markup': item[9],
            'classification_status': item[10],
            'sign_comments': item[11],
            'context_meaning': item[12],
            'syntactic_relation': item[13],
            'pos': item[14],
            'register': item[15],
            'comments': item[16]
        }
    return result


def get_token_by_id(token_id, c):
    c.execute("""
        SELECT tokens.id,
               lemmas.transliteration,
               lemmas.meaning,
               tokens.is_part_of_compound,
               tokens.compound_id,
               texts.text_name,
               tokens.coordinates_in_txt,
               '', -- textual_source.name,
               tokens.coordinates_in_ts,
               tokens.mdc,
               tokens.mdc_w_markup,
               tokens.classification_status,
               tokens.sign_comments,
               tokens.context_meaning,
               tokens.syntactic_relation,
               tokens.pos,
               tokens.register,
               tokens.comments
        FROM tokens
        LEFT JOIN lemmas -- replace by INNER JOINS in production
        ON tokens.lemma_id=lemmas.id
        LEFT JOIN texts
        ON tokens.super_text_id=texts.id
        WHERE tokens.id = ?""", (token_id,))
    token = c.fetchone()
    try:
        token_dic = {
            'lemma_transliteration': token[1],
            'lemma_meaning': token[2],
            'is_part_of_compound': token[3],
            'compound_id': token[4],
            'text_name': token[5],
            'text_coords': token[6],
            'textual_source': token[7],
            'ts_coords': token[8],
            'mdc': token[9],
            'mdc_w_markup': token[10],
            'classification_status': token[11],
            'sign_comments': token[12],
            'context_meaning': token[13],
            'syntactic_relation': token[14],
            'pos': token[15],
            'register': token[16],
            'comments': token[17]
        }
        return token_dic
    except TypeError:
        return {}


def extract_clfs(string):
    inside_clf = False
    temp = []
    for c in string:
        if c == '~':
            if inside_clf:
                yield ''.join(temp)
                temp = []
                inside_clf = False
            else:
                inside_clf = True
        else:
            if inside_clf:
                temp.append(c)


def get_all_clfs(c):
    result = set()
    for item in c.execute('SELECT mdc_w_markup FROM tokens'):
        for clf in extract_clfs(item[0]):
            result.add(clf)
    return sorted(result)


def delete_token(POST_data, conn, c):
    try:
        c.execute('DELETE FROM clf_parses WHERE token_id = ?', (POST_data['id'],))
        c.execute('DELETE FROM tokens WHERE id = ?', (POST_data['id'],))
        conn.commit()
        extract_token_table(c)
    except Exception as e:
        conn.rollback()
        raise e


def modify_token(POST_data, conn, c):
    print(POST_data)
    c.execute(
        """UPDATE tokens SET
            lemma_id = ?,
            is_part_of_compound = ?,
            compound_id = ?,
            super_text_id = ?,
            coordinates_in_txt = ?,
            textual_source = ?,
            coordinates_in_ts = ?,
            mdc = ?,
            mdc_w_markup = ?,
            classification_status = ?,
            sign_comments = ?,
            context_meaning = ?,
            syntactic_relation = ?,
            pos = ?,
            register = ?,
            comments = ?
            WHERE id = ?""",
        (
            POST_data['lemma_id'],
            POST_data['is_part_of_compound'],
            POST_data['compound_id'],
            POST_data['super_text_id'],
            POST_data['coordinates_in_txt'],
            POST_data['textual_source_id'],
            POST_data['coordinates_in_ts'],
            POST_data['mdc'],
            POST_data['mdc_w_markup'],
            POST_data['classification_status'],
            POST_data['sign_comments'],
            POST_data['context_meaning'],
            POST_data['syntactic_relation'],
            POST_data['pos'],
            POST_data['register'],
            POST_data['comments'],
            POST_data['id']
        )
    )
    print("Committing...")
    conn.commit()
    print("Committed...")
    extract_token_table(c)


def add_token(POST_data, conn, c):
    # Add token; get id; add clfs for the new id
    token_data = json.loads(POST_data['token_data'])
    clf_data = json.loads(POST_data['clf_data'])
    biblio_data = json.loads(POST_data['biblio_data'])
    c.execute("SELECT seq FROM SQLITE_SEQUENCE WHERE name = 'tokens' LIMIT 1;")
    new_token_id = c.fetchone()[0] + 1
    try:
        c.execute(
            """INSERT INTO tokens
                (lemma_id,
                is_part_of_compound,
                compound_id,
                super_text_id,
                coordinates_in_txt,
                textual_source,
                coordinates_in_ts,
                mdc,
                mdc_w_markup,
                classification_status,
                sign_comments,
                context_meaning,
                syntactic_relation,
                pos,
                register,
                comments)
                VALUES
                (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                token_data['lemma_id'],
                token_data['is_part_of_compound'],
                token_data['compound_id'],
                token_data['super_text_id'],
                token_data['coordinates_in_txt'],
                token_data['textual_source_id'],
                token_data['coordinates_in_ts'],
                token_data['mdc'],
                token_data['mdc_w_markup'],
                token_data['classification_status'],
                token_data['sign_comments'],
                token_data['context_meaning'],
                token_data['syntactic_relation'],
                token_data['pos'],
                token_data['register'],
                token_data['comments'])
        )
        clf_data['token_id'] = new_token_id
        update_clfs_for_token(clf_data, conn, c)
        biblio_data['biblioforid'] = new_token_id
        update_biblio_for_token(biblio_data, conn, c)
        extract_token_table(c)
    except Exception as e:
        conn.rollback()
        raise e
