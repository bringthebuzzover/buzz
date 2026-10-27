"""Move a pen from the 15-step type scale to the 8-step scale (tokens.DEV). Usage: retype.py file.pen ..."""
import sys,json,os; sys.path.insert(0,os.path.dirname(__file__))
import tokens
OLD={"display":(115.2,48),"title-xl":(66.24,38.4),"hero":(63.36,32.8),"title-lg":(56,21.6),"statement":(54,36),"join":(51.84,35.1),
 "h2":(43.2,32),"h3":(20,20),"h4":(18.72,17),"body-lg":(17,17),"body":(16,16),"small":(14,14),"label":(13,13),"micro":(12,12),"tiny":(11,11)}
TOK={"display":"display","title-xl":"title","hero":"title","title-lg":"statement","statement":"statement","join":"statement",
 "h2":"h2","h3":"h3","h4":"h3","body-lg":"body","body":"body","small":"small","label":"label","micro":"label","tiny":"label"}
# hard-coded sizes left over from the source code -> nearest step (desktop context unless noted)
RAW={18.4:"h3",15:"small",23.04:"h3",22:"h3",40:"h2",68:"title",9:"label",57.1:None}
NEW={k[5:]:v for k,v in tokens.DEV.items() if k.startswith('type-')}
def val(tab,k,dev): return tab[k][0 if dev=='desktop' else 1]
log=[]
def fix(n,dev):
    fs=n['fontSize']; old=None; new=None
    if isinstance(fs,str) and fs.startswith('$type-'):
        k=fs[6:]
        if k not in TOK: return
        old=val(OLD,k,dev); t=TOK[k]
        if k=='title-lg' and dev=='mobile':
            t='h3'  # footer email: 26 chars cannot sit at 32 inside 358
        new=t
    elif isinstance(fs,(int,float)):
        old=fs
        if fs==57.1: n['fontSize']=round(NEW['statement'][0]*1.02,2); log.append((n.get('id'),fs,'statement x1.02 (hover transform)')); sc(n,n['fontSize']/old); return
        if fs==28: new='h2' if dev=='mobile' else 'h3'
        elif fs==30: new='h2'; n['theme']={**n.get('theme',{}),'device':'mobile'}; dev='mobile'
        elif fs in RAW: new=RAW[fs]
        else: log.append((n.get('id'),fs,'UNMAPPED')); return
    else: return
    n['fontSize']='$type-'+new; nv=val(NEW,new,dev); log.append((n.get('id'),fs,dev,'$type-'+new,nv)); sc(n,nv/old)
def sc(n,r):
    if isinstance(n.get('letterSpacing'),(int,float)) and n['letterSpacing'] and abs(r-1)>1e-6: n['letterSpacing']=round(n['letterSpacing']*r,2)
def walk(n,dev):
    if isinstance(n,dict):
        th=n.get('theme')
        if isinstance(th,dict) and 'device' in th: dev=th['device']
        if 'fontSize' in n: fix(n,dev)
        for v in n.values(): walk(v,dev)
    elif isinstance(n,list):
        for v in n: walk(v,dev)
for p in sys.argv[1:]:
    log.clear(); d=json.load(open(p)); d['variables']=tokens.variables(); walk(d,'desktop')
    json.dump(d,open(p,'w'),indent=2 if p.endswith(('pulse-bee.pen','drop-editor.pen')) else 1,ensure_ascii=False)
    print(p,len(log)); [print('  ',l) for l in log if 'UNMAPPED' in str(l) or isinstance(l[1],(int,float)) or l[2]=='mobile' and l[3]=='$type-h3' and l[1]=='$type-title-lg']
