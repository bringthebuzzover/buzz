"""Generate the audience pens (orgs, brands) and the design-system pen from
the tokenised pulse-bee.pen + drop-editor.pen. Pure JSON; open in pen.dev after."""
import json, copy, random, string, uuid, sys
sys.path.insert(0,__import__('os').path.dirname(__file__))
P=''+__import__('os').path.join(__import__('os').path.dirname(__file__),'..','')+''
PB=json.load(open(P+'pulse-bee.pen')); DE=json.load(open(P+'drop-editor.pen'))
IDX={}
def walk(n):
    if 'id' in n: IDX[n['id']]=n
    for c in n.get('children',[]): walk(c)
for c in PB['children']+DE['children']: walk(c)
USED=set(IDX)
def nid():
    while True:
        s=random.choice(string.ascii_letters)+''.join(random.choice(string.ascii_letters+string.digits) for _ in range(4))
        if s not in USED: USED.add(s); return s
def clone(id_or_node, **over):
    n=copy.deepcopy(IDX[id_or_node] if isinstance(id_or_node,str) else id_or_node)
    def re(x):
        x['id']=nid()
        for c in x.get('children',[]): re(c)
    re(n); n.update(over); return n
def find(n,name):
    if n.get('name')==name: return n
    for c in n.get('children',[]):
        r=find(c,name)
        if r: return r
F='$font'
def T(name,content,size,fill='$on-surface',weight='normal',**kw):
    t={'type':'text','id':nid(),'name':name,'fill':fill,'content':content,'fontFamily':F,'fontSize':size,'fontWeight':weight}
    t.update(kw); return t
def FR(name,children=None,**kw):
    f={'type':'frame','id':nid(),'name':name}; f.update(kw)
    if children is not None: f['children']=children
    return f
def REF(ref,name,**kw):
    r={'type':'ref','id':nid(),'ref':ref,'name':name}; r.update(kw); return r

# ---------------- new shared components (fixed ids so every file matches) ----------------
def comp_defs():
    C=[]
    # Section head
    C.append(FR('Section / Head',[
        T('Title','Partner with brands','$type-h2',id='SecHdT',weight='500',lineHeight=1,letterSpacing=-1.73,textAlign='center',textGrowth='fixed-width',width='fill_container'),
        FR('Support wrap',[T('Support','Merch and product samples for your organization.','$type-body',id='SecHdS',fill='$on-surface-muted',lineHeight=1.5,textAlign='center',textGrowth='fixed-width',width='fill_container')],width='fill_container',padding=['$space-4',0,0,0])
    ],id='SecHd',reusable=True,width=704,layout='vertical',alignItems='center'))
    # Numbered card (photo)
    def card(cid,name,mark):
        media_children=[]
        if mark:
            media_children.append(FR('Bee',id=cid+'b',width=125,height=125,fill={'type':'image','enabled':True,'url':'images/pulse-bee/bee.png','mode':'contain'}))
        badge=FR('Number',[T('N','1','$type-small',fill='$yellow' if mark else '$ink',weight='500',lineHeight=1,id=cid+'n')],
                 id=cid+'badge',layoutPosition='absolute',x=16,y=16,width=32,height=32,cornerRadius='$radius-pill',
                 fill='$ink' if mark else '$yellow',justifyContent='center',alignItems='center')
        media_children.append(badge)
        media=FR('Media',media_children,id=cid+'m',width='fill_container',height=345,clip=True,cornerRadius='$radius-card',
                 fill='$yellow' if mark else [{'type':'color','enabled':True,'color':'$grey-media'},{'type':'image','enabled':True,'url':'images/pulse-bee/yerba-madre.jpg','mode':'fill'}],
                 justifyContent='center',alignItems='center')
        return FR(name,[media,
            FR('Title wrap',[T('Title','Brand products, shipped to you','$type-h3',weight='500',lineHeight=1.25,letterSpacing=-0.2,textGrowth='fixed-width',width='fill_container',id=cid+'t')],width='fill_container',padding=['$space-5',0,0,0]),
            FR('Body wrap',[T('Body','If you’re accepted on a drop, products ship to the address you gave when you applied.','$type-body',fill='$on-surface-muted',lineHeight=1.5,textGrowth='fixed-width',width='fill_container',id=cid+'d')],width='fill_container',padding=['$space-2',0,0,0]),
        ],id=cid,reusable=True,width=368,layout='vertical')
    C.append(card('CardPh','Card / Numbered / Photo',False))
    C.append(card('CardMk','Card / Numbered / Mark',True))
    # FAQ item
    def faq(cid,name,open_):
        ch=[FR('Hairline',id=cid+'h',width='fill_container',height=1,fill='$hairline'),
            FR('Summary',[T('Question','Who can apply?','$type-h3',weight='500',lineHeight=1.3,letterSpacing=-0.19,textGrowth='fixed-width',width='fill_container',id=cid+'q'),
                          {'type':'icon','id':cid+'i','name':'Icon','width':14,'height':14,'icon':'x' if open_ else 'plus','library':'lucide','fill':'$on-surface'}],
               id=cid+'s',width='fill_container',height=64,gap='$space-4',alignItems='center',justifyContent='space_between')]
        if open_:
            ch.append(FR('Answer wrap',[T('Answer','Student organizations with a campus .edu email you can verify and the organization’s Instagram Business or Creator account.','$type-body',fill='$on-surface-muted',lineHeight=1.5,textGrowth='fixed-width',width=540,id=cid+'a')],id=cid+'aw',width='fill_container',padding=[0,0,'$space-5',0]))
        return FR(name,ch,id=cid,reusable=True,width=747,layout='vertical')
    C.append(faq('FaqCl','FAQ / Item',False))
    C.append(faq('FaqOp','FAQ / Item / Open',True))
    # Ghost pill
    C.append(FR('Pill / Ghost',[T('Label','Run a campus activation','$type-small',fill='$on-surface',id='GhostL')],id='Ghost',reusable=True,height=44,padding=[0,'$space-5'],
                cornerRadius='$radius-pill',stroke='$on-surface',strokeWidth=1,justifyContent='center',alignItems='center'))
    # Arrow button
    C.append(FR('Button / Arrow',[{'type':'icon','id':'ArrowI','name':'Icon','width':18,'height':18,'icon':'chevron-right','library':'lucide','fill':'$on-surface'}],
                id='ArrowB',reusable=True,width=40,height=40,cornerRadius='$radius-pill',stroke='$on-surface',strokeWidth=1,justifyContent='center',alignItems='center'))
    return C

def lay_components(comps, x0=0, y0=-3000):
    x=x0;y=y0;rowh=0
    for c in comps:
        w=c.get('width',200); w=w if isinstance(w,(int,float)) else 300
        h=c.get('height',400); h=h if isinstance(h,(int,float)) else 500
        if x+w>3200: x=x0;y+=rowh+80;rowh=0
        c['x']=x;c['y']=y;x+=w+80;rowh=max(rowh,h)
    return comps

def base_vars():
    from tokens import variables
    return variables()

def doc(children):
    return {'version':PB['version'],'children':children,'variables':base_vars(),'themes':PB['themes'],'fileToken':str(uuid.uuid4()),'fonts':PB['fonts']}

def existing_components():
    return [copy.deepcopy(c) for c in PB['children'] if c.get('reusable')]

# ---------------- page builders ----------------
def set_text(n,name,content,**kw):
    t=find(n,name); assert t,(name)
    t['content']=content; t.update(kw); return t

def hero(src_id,image,lines,sub,cta,aside,mobile,dock=None):
    h=clone(src_id)
    h['fill'][0]['url']=image
    set_text(h,'Headline',lines)
    set_text(h,'Sub',sub)
    j=find(h,'Join'); j.setdefault('descendants',{})['m3z8Gw']={'content':cta}
    link=find(h,'How it works link')
    # wrap pill + link into an Actions row so a longer CTA cannot collide with the link
    h['children']=[c for c in h['children'] if c not in (j,link)]
    act=FR('Actions',[{k:v for k,v in j.items() if k not in ('x','y')},{k:v for k,v in link.items() if k not in ('x','y')}],x=j['x'],y=j['y'],gap='$space-5',alignItems='center')
    h['children'].insert(2,act)
    if mobile:
        d=find(h,'Dock (fixed to viewport bottom)'); dp=d['children'][0]; dp['descendants']={'m3z8Gw':{'content':dock}}
    else:
        set_text(h,'Line',aside)
    return h

def statement(src_id,l1,l2):
    s=clone(src_id); set_text(s,'Line 1',l1); set_text(s,'Line 2 (quiet)',l2); s.pop('height',None)
    s['padding']=['$section-y','$side']; return s

def section(name,children,ink=False,mobile=False,tight=False,pad_bottom=True):
    f=FR(name,children,width='fill_container',layout='vertical',alignItems='center',fill='$surface',
         padding=[0 if tight else '$section-y','$side','$section-y' if pad_bottom else 0,'$side'])
    if ink: f['theme']={'surface':'ink'}
    return f

def head(title,support,mobile):
    return REF('SecHd','Head',width='fill_container' if mobile else 704,
               descendants={})  # descendants filled below

def mk_head(title,support,mobile):
    r=REF('SecHd','Head',width='fill_container' if mobile else 704)
    t=r['id']
    r['descendants']={}
    return r,title,support

def cards(cards,mobile):
    items=[]
    for i,(title,body,img) in enumerate(cards):
        cid='CardPh' if img else 'CardMk'
        d={cid+'n':{'content':str(i+1)},cid+'t':{'content':title},cid+'d':{'content':body}}
        if img: d[cid+'m']={'fill':[{'type':'color','enabled':True,'color':'$grey-media'},{'type':'image','enabled':True,'url':img,'mode':'fill'}]}
        if mobile: d.setdefault(cid+'m',{})['height']=268.5
        items.append(REF(cid,f'Card {i+1}',width='fill_container',descendants=d))
    if mobile:
        return FR('Cards',items,width='fill_container',layout='vertical',gap='$space-6')
    return FR('Cards',items,width=1152,gap='$space-5')

def faq_section(qas,mobile,ink):
    rows=[]
    for i,(q,a) in enumerate(qas):
        if i==0:
            rows.append(REF('FaqOp',f'Q{i+1} (open)',width='fill_container',descendants={'FaqOpq':{'content':q},'FaqOpa':{'content':a,'width':'fill_container' if mobile else 540}}))
        else:
            rows.append(REF('FaqCl',f'Q{i+1}',width='fill_container',descendants={'FaqClq':{'content':q}}))
    rows.append(FR('Hairline',width='fill_container',height=1,fill='$hairline'))
    lst=FR('List',rows,width='fill_container',layout='vertical')
    title=T('Title','Questions','$type-title',weight='500',lineHeight=0.95,letterSpacing=-2.98)
    if mobile:
        body=FR('FAQ',[title,lst],width='fill_container',layout='vertical',gap='$space-5')
    else:
        body=FR('FAQ',[FR('Title col',[title],width=373),FR('List col',[lst],width=747)],width=1152,gap='$space-6')
    return section('Questions'+(' (ink)' if ink else ''),[body],ink=ink,mobile=mobile)

def goals_section(mobile):
    h=T('Title','What are you hoping\nto do on Buzz?','$type-statement',weight='500',lineHeight=1,letterSpacing=-2.7 if not mobile else -1.8,textAlign='center',textGrowth='fixed-width',width=640 if not mobile else 'fill_container')
    sup=FR('Support wrap',[T('Support','Tell us in your application.','$type-body',fill='$on-surface-muted',lineHeight=1.5,textAlign='center')],padding=['$space-4',0,0,0])
    chips=[REF('Ghost',g,descendants={'GhostL':{'content':g}}) for g in ["Run a campus activation","Get product to student organizations","Grow Instagram engagement","Reach more campuses"]]
    if mobile:
        row=FR('Chips',chips,layout='vertical',gap='$space-3',alignItems='center',padding=['$space-7',0,0,0])
    else:
        row=FR('Chips',chips,gap='$space-3',padding=['$space-7',0,0,0],justifyContent='center')
    s=section('Goals (ink)',[h,sup,row],ink=True,mobile=mobile)
    s['padding']=[126 if not mobile else 84,'$side']
    return s

def join_block(src_id,order,mobile,org_quiet,brand_quiet,org_pill,brand_pill):
    j=clone(src_id)
    halves={c['name']:c for c in j['children']}
    org=halves['Half — For organizations']; br=halves['Half — For brands']
    def setq(h,q):
        ql=find(h,'Quiet link')
        if q: ql['content']=q
        else:
            # remove quiet link (and its gap on mobile)
            def rm(n):
                if 'children' not in n: return
                n['children']=[c for c in n['children'] if c is not ql]
                for c in n['children']: rm(c)
            rm(h)
    setq(org,org_quiet); setq(br,brand_quiet)
    find(org,'Pill')['descendants']['o48sD']['content']=org_pill
    find(br,'Pill')['descendants']['o48sD']['content']=brand_pill
    first,second=(org,br) if order=='org' else (br,org)
    st=br.get('stroke'); sw=br.get('strokeWidth')
    for h in (org,br): h.pop('stroke',None); h.pop('strokeWidth',None)
    second['stroke']=st; second['strokeWidth']=sw
    j['children']=[first,second]
    return j

def nav(mobile,cta):
    r=clone('L3teEq' if mobile else 'CWCQJ')
    if not mobile and cta: r['descendants']={'cIN8B/m3z8Gw':{'content':cta}}
    return r

def page(name,w,sections,mobile,navref,x,y):
    f=FR(name,sections+[navref],x=x,y=y,width=w,layout='vertical',fill='$ink',clip=True)
    if mobile: f['theme']={'device':'mobile'}
    return f

def mkhead(title,support,mobile):
    return REF('SecHd','Head',width='fill_container' if mobile else 704,descendants={'SecHdT':{'content':title},'SecHdS':{'content':support}})
