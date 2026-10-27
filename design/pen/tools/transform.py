import json, uuid, sys
sys.path.insert(0,__import__('os').path.dirname(__file__))
from tokens import *
def tokenise(doc, rename={}, img_prefix=None, mobile_pred=lambda n: False):
    dmap={a:k for k,(a,b) in DEV.items() if k.startswith('type-')}
    mmap={b:k for k,(a,b) in DEV.items() if k.startswith('type-')}
    # mobile has duplicates (20,17,16..): first wins; ok since equal values
    sp={v:k for k,v in N.items() if k.startswith('space-')}
    rad={999:'radius-pill',99:'radius-pill',8:'radius-card',32:'radius-phone',10:'radius-field',16:'radius-board'}
    stats={'hex':0,'font':0,'rad':0,'space':0,'ren':0}
    def colr(x):
        if isinstance(x,str):
            if x.startswith('$') and x[1:] in rename: stats['ren']+=1; return '$'+rename[x[1:]]
            if x.startswith('#') and x.lower() in HEX2TOK: stats['hex']+=1; return '$'+HEX2TOK[x.lower()]
        return x
    def fixfill(f):
        if isinstance(f,list): return [fixfill(i) for i in f]
        if isinstance(f,dict):
            f=dict(f)
            if 'color' in f: f['color']=colr(f['color'])
            if 'colors' in f: f['colors']=[dict(c,color=colr(c['color'])) for c in f['colors']]
            if f.get('type')=='image' and img_prefix and f.get('url','').startswith('images/') and not f['url'].startswith(img_prefix):
                f['url']=img_prefix+f['url'][len('images/'):]
            return f
        return colr(f)
    def spc(x):
        if isinstance(x,(int,float)) and x in sp: stats['space']+=1; return '$'+sp[x]
        if isinstance(x,list): return [spc(i) for i in x]
        return x
    def walk(n, mobile):
        for k in ('fill','stroke'):
            if k in n: n[k]=fixfill(n[k])
        if 'effect' in n:
            e=n['effect']; es=e if isinstance(e,list) else [e]
            for i in es:
                if 'color' in i: i['color']=colr(i['color'])
        for k in ('fontFamily',):
            if k in n: n[k]=colr(n[k])
        if n.get('type')=='text' and isinstance(n.get('fontSize'),(int,float)):
            m=mmap if mobile else dmap
            if n['fontSize'] in m: n['fontSize']='$'+m[n['fontSize']]; stats['font']+=1
        cr=n.get('cornerRadius')
        if isinstance(cr,(int,float)) and cr in rad: n['cornerRadius']='$'+rad[cr]; stats['rad']+=1
        if n.get('type')=='frame':
            for k in ('gap','padding'):
                if k in n: n[k]=spc(n[k])
        if 'descendants' in n:
            for dv in n['descendants'].values(): walk(dv, mobile)
        for c in n.get('children',[]): walk(c, mobile)
    for c in doc['children']:
        mob=mobile_pred(c)
        if mob: c['theme']=dict(c.get('theme',{}),device='mobile')
        walk(c, mob)
    doc['variables']=variables(); doc['themes']=THEMES; doc['fileToken']=str(uuid.uuid4())
    return stats
if __name__=='__main__':
    src,dst,kind=sys.argv[1:4]
    d=json.load(open(src))
    if kind=='pulse':
        s=tokenise(d,{'btn':'ink-btn'},None,lambda n:'Mobile 390' in n.get('name',''))
    else:
        s=tokenise(d,{'y':'yellow','y-fade':'yellow-faded','mut':'paper-52','faint':'paper-30','line':'paper-09','s1':'paper-04','s2':'paper-08','card':'ink-raised','pop':'ink-pop'},'images/drop-editor/')
    json.dump(d,open(dst,'w'),indent=2); print(s)
