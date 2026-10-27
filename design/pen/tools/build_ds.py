import sys,json; sys.path.insert(0,__import__('os').path.dirname(__file__))
from gen import *
from tokens import C as BASE, SEM, N, DEV
SUF=sys.argv[1] if len(sys.argv)>1 else ''
def lbl(t,size='$type-micro',fill='$on-surface-muted',**kw): return T('Label',t,size,fill=fill,lineHeight=1.4,**kw)
def h2(t): return T('H2',t,'$type-h2',weight='500',lineHeight=1,letterSpacing=-1.73)
def para(t,w=720): return T('Note',t,'$type-body',fill='$on-surface-muted',lineHeight=1.5,textGrowth='fixed-width',width=w)
def block(title,note,body,ink=False):
    f=FR(title,[h2(title),para(note),FR('Gap',width=10,height=8),body],width='fill_container',layout='vertical',gap='$space-4',fill='$surface',padding=['$space-8','$side'])
    if ink: f['theme']={'surface':'ink'}
    return f
def swatch(name,val,var=None):
    return FR('Swatch '+name,[FR('Chip',width=128,height=88,cornerRadius='$radius-card',fill='$'+(var or name),stroke='$hairline',strokeWidth=1),
        T('Name',name,'$type-small',weight='500'),lbl(val)],layout='vertical',gap='$space-2',width=128)
def grid(items,cols=8,gap='$space-5'):
    rows=[FR('Row',items[i:i+cols],gap=gap) for i in range(0,len(items),cols)]
    return FR('Grid',rows,layout='vertical',gap=gap)
# --- Foundations ---
base=[swatch(k,v) for k,v in BASE.items()]
sem_paper=[swatch(k,SEM[k][0]) for k in SEM]; sem_ink=[swatch(k,SEM[k][1]) for k in SEM]
TYPE=[('type-display','Display: footer “Want to join?”','Want to join?',-0.04),('type-hero','Hero headline (all pulse-bee pages)','Campus marketing,',-0.04),('type-title-xl','Title XL: Current drops, Questions','Current drops',-0.045),
('type-statement','Statement bands, goals','You request a call.',-0.05),('type-h2','Section heads, College network','College network',-0.04),
('type-title-lg','Footer email, drop card brand','hello@bringthebuzzover.com',-0.05),('type-join','Join half titles','Request a campaign.',-0.045),('type-h3','Card titles, step captions','Brand products, shipped to you',-0.01),('type-h4','FAQ questions','Who can apply?',-0.01),('type-body-lg','Join support','You apply on the website first.',0),
('type-body','Body, support lines','Vetted student organizations powering authentic campus marketing nationwide.',0),('type-small','Nav links, pills, buttons, drop-editor base','How it works',0),
('type-label','Kickers, small pills','For organizations',0),('type-micro','Footer meta, captions','Collaboration at Cornell University',0),('type-tiny','Drop-editor micro labels','APPLY WINDOW',0)]
rows=[]
TYPE.sort(key=lambda t:-DEV[t[0]][0])
for tok,use,sample,ls in TYPE:
    d,m=DEV[tok]
    w='500' if tok in ('type-display','type-hero','type-title-lg','type-join','type-title-xl','type-statement','type-h2','type-h3','type-h4') else 'normal'
    rows.append(FR('Type '+tok,[FR('Meta',[T('Token',tok,'$type-small',weight='500'),lbl(f'{d} / {m} px · {"Medium 500" if w=="500" else "Regular 400"}'+(f' · ls {ls}em' if ls else '')),lbl(use)],layout='vertical',gap='$space-1',width=320),
        T('Sample',sample,'$'+tok,weight=w,lineHeight=1 if w=='500' else 1.4,letterSpacing=round(ls*d,2) if ls else 0,textGrowth='fixed-width',width=960)],
        width='fill_container',gap='$space-6',alignItems='center',padding=['$space-4',0],stroke='$hairline',strokeWidth={'top':1}))
typ=FR('Type rows',rows,width='fill_container',layout='vertical')
sp=[FR('Space '+k,[FR('Bar',width=v,height=v,fill='$yellow',cornerRadius=2),T('Name',k,'$type-small',weight='500'),lbl(f'{v}px')],layout='vertical',gap='$space-2',width=max(v,72)) for k,v in N.items() if k.startswith('space')]
rad=[FR('Radius '+k,[FR('Box',width=96,height=64,cornerRadius='$'+k,fill='$card-surface',stroke='$on-surface',strokeWidth=1),T('Name',k,'$type-small',weight='500'),lbl(f'{v}px')],layout='vertical',gap='$space-2',width=110) for k,v in N.items() if k.startswith('radius')]
dev=[FR('Dev '+k,[T('Name',k,'$type-small',weight='500'),lbl(f'desktop {a} · mobile {b}')],layout='vertical',gap='$space-1',width=200) for k,(a,b) in DEV.items() if not k.startswith('type')]
BLACK=("Black rhythm (from /pulse-bee): photo hero with ink scrim → paper bands → ink or photo band → paper → ink footer. "
 "Audience pages (orgs, brands) alternate after the statement so no more than two paper bands sit together; /pulse-bee keeps its own order. Ink bands use the same components with theme surface=ink, so "
 "text flips to paper, muted text to paper-60, hairlines to paper-09. Yellow is only for the primary pill, number badges, the bee tile "
 "and map pins. Buttons on paper are ink-btn (#111); on ink they are yellow or ghost (1px paper outline).")
found=FR('Foundations',[
  FR('Cover',[T('Kicker','BUZZ · design system','$type-label',fill='$on-surface-muted'),T('Title','Foundations','$type-display',weight='500',lineHeight=1,letterSpacing=-4.6),
     para('Source of truth: /pulse-bee (design/pen/pulse-bee.pen). Every token below is read off pulseBee.css, pulseBeeAudience.css and drop-editor.css at 1440 and 390. Font: Switzer 400 / 500.',900)],
     width='fill_container',layout='vertical',gap='$space-5',fill='$surface',padding=['$space-9','$side','$space-8','$side'],theme={'surface':'ink'}),
  block('Base palette','Raw colors. Alphas are written as the base color with an alpha suffix (ink-64 = #0b0b0b at 64%).',grid(base,9)),
  FR('Semantic',[block('Semantic · paper','theme surface=paper. Use these in components, never raw colors.',grid(sem_paper,7)),
                 block('Semantic · ink','theme surface=ink. Same tokens, flipped.',grid(sem_ink,7),ink=True)],width='fill_container',layout='vertical'),
  block('Black usage',BLACK,FR('Rhythm',[FR('Band '+n,[T('L',n,'$type-micro',fill='$on-surface',textAlign='center',textGrowth='fixed-width',width=140)],width=140,height=56,fill='$surface',justifyContent='center',alignItems='center',cornerRadius=4,stroke='$hairline',strokeWidth=1,theme={'surface':s})
        for n,s in [('Hero (photo)','ink'),('Statement','paper'),('Section','paper'),('Ink band','ink'),('Section','paper'),('Ink band','ink'),('Join','paper'),('Footer','ink')]],gap='$space-2')),
  block('Type scale','Device-themed number tokens: values switch with theme device=desktop|mobile. Display and statement weights are 500 with tight tracking; body copy 400.',typ),
  block('Spacing','4-based scale (pulse .pulse2 --s1…--s9). Section padding uses section-y (12svh) and side (clamp 1rem, 3.3vw, 3rem).',FR('Row',sp+dev,gap='$space-6',alignItems='end')),
  block('Radii','Pills are fully round. Cards and media 8. Fields 10 (drop editor). Boards 16. Phone 32.',FR('Row',rad,gap='$space-6')),
],x=0,y=0,width=1440,layout='vertical',fill='$paper')
# --- Components page ---
def show(name,node,ink=False,note=None):
    ch=[T('Name',name,'$type-small',weight='500'),FR('Stage',[node],padding='$space-5',fill='$surface',cornerRadius='$radius-board',stroke='$hairline',strokeWidth=1)]
    if note: ch.insert(1,lbl(note))
    f=FR('Spec '+name,ch,layout='vertical',gap='$space-2')
    if ink: f['theme']={'surface':'ink'}
    return f
def ref(r,**kw): return REF(r,'Instance',**kw)
marketing=[
 show('Pill / Yellow',ref('uKtnH'),True,'Primary CTA · 40 or 44 high · ink text'),
 show('Pill / Dark',ref('XHmYw',descendants={'ARbUw':{'enabled':True}}),False,'Secondary on paper · ink-btn'),
 show('Pill / Ghost (on ink)',ref('Ghost'),True,'1px on-surface outline'),
 show('Pill / Ghost (on paper)',ref('Ghost',descendants={'GhostL':{'content':'Reach more campuses'}}),False),
 show('Button / Arrow',ref('ArrowB'),False,'Carousel prev/next · 40'),
 show('LogoItem',ref('lM2vX'),False,'College logo in marquee · 48'),
 show('MapPin',ref('QFtyV'),False,'Campus pin'),
]
big=[
 show('NavBar',ref('H3d268'),True,'Desktop · floating glass bar · 1152 wide'),
 show('NavBar / Mobile',ref('YSw6B'),True,'Mobile · 374 wide'),
 show('Section / Head',ref('SecHd'),False,'Centered h2 + support · 704 measure'),
 show('Section / Head (ink)',ref('SecHd'),True),
 FR('Cards',[show('Card / Numbered / Photo',ref('CardPh'),False,'16:15 media (4:3 mobile) · yellow badge'),show('Card / Numbered / Mark',ref('CardMk'),False,'Yellow bee tile · ink badge'),show('Card / Numbered / Photo (ink)',ref('CardPh'),True)],gap='$space-6'),
 FR('FAQ',[show('FAQ / Item',ref('FaqCl'),False,'64 row · hairline top'),show('FAQ / Item / Open',ref('FaqOp'),True,'Open state on ink')],gap='$space-6'),
 show('DropCard',ref('N4ul60'),False,'Current drops slide'),
 show('FooterColumn',ref('RArr7'),True),
]
app=[
 show('App / Field',ref('QhHN7'),False,'Phone mock field'),show('App / Button',ref('V6GNvM'),False),show('App / Chip',ref('Brjmq'),False),
 show('Pill (drop editor)',ref('O4h20f'),True),show('Chip (drop editor)',ref('vTXYD'),True),show('Campus chip',ref('hN5sG'),True),show('Toggle',ref('cw9tO'),True),show('Stat',ref('e5JjE'),True),
]
app2=[show('Section header (drop editor)',ref('e0Bt4'),True),show('Time row',ref('xNCzN'),True),show('Detail row',ref('CCoIO'),True),show('Date range popover',ref('I3tYj'),True)]
compsP=FR('Components',[
  FR('Cover',[T('Kicker','BUZZ · design system','$type-label',fill='$on-surface-muted'),T('Title','Components','$type-display',weight='500',lineHeight=1,letterSpacing=-4.6),
     para('Every page pen carries these same components (pen.dev cannot share components across files). Definitions sit above the pages in each file; this board shows each one on paper and ink.',900)],
     width='fill_container',layout='vertical',gap='$space-5',padding=['$space-9','$side','$space-8','$side'],fill='$surface',theme={'surface':'ink'}),
  FR('Marketing · small',[h2('Marketing · controls'),FR('Row',marketing,gap='$space-6',alignItems='start')],layout='vertical',gap='$space-5',padding=['$space-8','$side',0,'$side'],width='fill_container'),
  FR('Marketing · blocks',[h2('Marketing · blocks')]+big,layout='vertical',gap='$space-6',padding=['$space-8','$side'],width='fill_container'),
  FR('App',[h2('App · drop editor'),FR('Row',app,gap='$space-5',alignItems='start'),FR('Row',app2[:3],gap='$space-5',alignItems='start'),app2[3]],layout='vertical',gap='$space-5',padding=['$space-8','$side'],width='fill_container',fill='$surface',theme={'surface':'ink'}),
],x=1600,y=0,width=2240,clip=True,layout='vertical',fill='$paper')
comps=existing_components()+[copy.deepcopy(c) for c in DE['children'] if c.get('reusable')]+comp_defs()
lay_components(comps,0,-3400)
d=doc(comps+[found,compsP]); json.dump(d,open(P+f'buzz-design-system{SUF}.pen','w'),indent=1,ensure_ascii=False); print('ok')
