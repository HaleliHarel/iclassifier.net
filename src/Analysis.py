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

def get_tokens_for_clf(clf, c):
    result = {}
    for item in c.execute("""
        SELECT tokens.id,                 -- 0
               tokens.witness_id,         -- 1
               tokens.mdc_w_markup,       -- 2
               tokens.syntactic_relation, -- 3
               tokens.pos,                -- 4
               lemmas.transliteration,    -- 5
               lemmas.meaning             -- 6
        FROM tokens INNER JOIN lemmas WHERE tokens.lemma_id = lemmas.id"""):
        if f'~{clf}~' in item[2]:
            result[item[0]] = {
                'witness': item[1],
                'mdc_w_markup': item[2],
                'syntactic_relation': item[3],
                'pos': item[4],
                'lemma': item[5],
                'lemma_meaning': item[6]
            }
    return result
