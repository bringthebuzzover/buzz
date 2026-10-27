"""Second pass: map the remaining recurring pulse-bee sizes to the new type tokens. No visual change."""
import json,sys
sys.path.insert(0,__import__('os').path.dirname(__file__))
from tokens import variables
MAP={63.36:'$type-hero',32.8:'$type-hero',51.84:'$type-join',35.1:'$type-join',56:'$type-title-lg',21.6:'$type-title-lg'}
def run(path):
    d=json.load(open(path)); n=[0]
    def w(x,mobile):
        mobile = mobile or (x.get('theme',{}).get('device')=='mobile')
        if x.get('type')=='text' and isinstance(x.get('fontSize'),(int,float)) and x['fontSize'] in MAP:
            fs=x['fontSize']
            if (fs in (32.8,35.1,21.6))==mobile: x['fontSize']=MAP[fs]; n[0]+=1
        for c in x.get('children',[]): w(c,mobile)
    for c in d['children']: w(c,False)
    d['variables']=variables()
    json.dump(d,open(path,'w'),indent=2,ensure_ascii=False); print(path,n[0])
for p in sys.argv[1:]: run(p)
