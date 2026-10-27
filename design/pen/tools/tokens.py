import json, uuid, re
C = {  # base palette
 "ink":"#0b0b0b","ink-raised":"#121212","ink-pop":"#161616","ink-btn":"#111111",
 "paper":"#f0f0f0","white":"#ffffff","grey-media":"#dddddd",
 "yellow":"#f6d32a","yellow-hover":"#e0be16","yellow-faded":"#f6d32a24",
 "ink-64":"#0b0b0ba3","ink-30":"#0b0b0b4d","ink-16":"#11111129","ink-08":"#0b0b0b14",
 "paper-60":"#f0f0f099","paper-52":"#f0f0f085","paper-30":"#f0f0f04d","paper-09":"#f0f0f017","paper-08":"#f0f0f014","paper-04":"#f0f0f00a",
 "success":"#166534","success-wash":"#f0fdf4","warn":"#b45309","warn-wash":"#fffbeb","danger":"#b91c1c","danger-wash":"#fef2f2",
}
SEM = {  # themed by surface: paper (light) / ink (dark)
 "surface":("#f0f0f0","#0b0b0b"),"on-surface":("#0b0b0b","#f0f0f0"),
 "on-surface-muted":("#0b0b0ba3","#f0f0f099"),"on-surface-quiet":("#0b0b0b4d","#f0f0f04d"),
 "hairline":("#11111129","#f0f0f017"),"card-surface":("#ffffff","#121212"),
 "pill-ghost-fill":("#0b0b0b14","#f0f0f014"),
}
N = {"space-1":4,"space-2":8,"space-3":12,"space-4":16,"space-5":24,"space-6":32,"space-7":48,"space-8":64,"space-9":96,
     "radius-control":8,"radius-card":8,"radius-field":10,"radius-board":16,"radius-phone":32,"radius-pill":999}
DEV = {  # desktop 1440 / mobile 390. Type: 8 steps (consolidated from 15, see README)
 "side":(48,16),"section-y":(108,68),
 "type-display":(115,48),"type-title":(64,36),"type-statement":(54,32),"type-h2":(44,28),
 "type-h3":(20,20),"type-body":(16,16),"type-small":(14,14),"type-label":(12,12)}
def variables():
    v={k:{"type":"color","value":x} for k,x in C.items()}
    for k,(l,d) in SEM.items(): v[k]={"type":"color","value":[{"value":l,"theme":{"surface":"paper"}},{"value":d,"theme":{"surface":"ink"}}]}
    for k,x in N.items(): v[k]={"type":"number","value":x}
    for k,(a,b) in DEV.items(): v[k]={"type":"number","value":[{"value":a,"theme":{"device":"desktop"}},{"value":b,"theme":{"device":"mobile"}}]}
    v["font"]={"type":"string","value":"Switzer"}
    return v
THEMES={"surface":["paper","ink"],"device":["desktop","mobile"]}
HEX2TOK={x.lower():k for k,x in C.items()}
