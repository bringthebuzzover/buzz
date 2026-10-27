import sys,json; sys.path.insert(0,__import__('os').path.dirname(__file__))
from gen import *
SUF=sys.argv[1] if len(sys.argv)>1 else ''
THETA='images/pulse-bee/yerba-madre.jpg'; ENT='images/pulse-bee/update.jpg'
ORG_FAQ=[("Who can apply?","Student organizations with a campus .edu email you can verify and the organization’s Instagram Business or Creator account."),
("Can we use a personal Instagram account?","No. Use the organization’s Business or Creator account, not a member’s personal profile. Personal accounts cannot be used on Buzz."),
("When do we connect Instagram?","After Buzz approves you. Accept Buzz’s Instagram Tester invite, then Connect Instagram on the organization account. It binds that account; it does not create a new one."),
("We didn’t get the verification email.","Check Junk on campus Outlook."),
("How do we log in later?","With Login with Instagram, on the organization account you connected."),
("When can we apply to a drop?","While it’s Open. An Upcoming drop shows a countdown, and Notify Me emails your .edu address before it opens."),
("How do we hear back on a drop?","After the apply window closes, the brand picks organizations up to the number of spots. Accepted drops move to My Campaigns. If you’re not picked, you get an email."),
("Where do products ship?","To the shipping address on your application. Shipping is US-only, including PO Boxes and campus CPO.")]
BR_FAQ=[("How do we get started?","Apply as a brand with your brand name and company email. Buzz reviews it, then emails you a setup link to set your password."),
("Do we build the campaign ourselves?","No. You send a drop request, and a representative will contact you. Buzz writes the drop and publishes it. Brands don’t create a live campaign from the portal."),
("Who handles logistics?","A Buzz representative handles agreements, logistics, product shipment, and scheduling."),
("Who posts about our brand?","Vetted student organizations, from the organization’s Instagram Business or Creator account."),
("Do we choose the organizations?","Yes. After the apply window closes, you approve or deny applicants, up to the number of spots."),
("What can we see after the drop is published?","A read-only tracker (Awaiting Products, Drop Active, Drop Finished), your applicants, and each post’s likes, comments, and estimated reach.")]
GETS=[("Brand products, shipped to you","If you’re accepted on a drop, products ship to the address you gave when you applied.",THETA),
("Post from your own account","Post from the organization’s Instagram and see your posts, likes, comments, and reach in My Campaigns.",ENT),
("More than one drop","Your organization can hold spots on more than one drop at the same time.",None)]
BSTEPS=[("Request a call","Apply as a brand and request a campaign. A representative will contact you.",None),
("Buzz mints and publishes the drop","Buzz writes the drop. Once it’s published, vetted student organizations see it on the Drop Feed.",ENT),
("Organizations post","Organizations apply while the drop is Open, then post from their Instagram Business or Creator account.",THETA)]

def orgs(mobile):
    m=mobile
    secs=[hero('qDMTv' if m else 'R5ILF',THETA,"Brand drops\nfor student\norganizations.","You apply on the website first. Instagram comes after Buzz approves you.","Join","Yerba Madre x Cornell University",m,dock="Join as a student organization"),
          statement('n69XHO' if m else 'GRA5A',"Give your community something extra to show up for","while cutting hosting costs."),
          section('Partner with brands (ink)',[mkhead("Partner with brands","Merch and product samples for your organization.",m),FR('Gap',width=10,height=48),cards(GETS,m)],ink=True),
          clone('rXoqx' if m else 'z1nrqn'),
          clone('xij3j' if m else 'wX2ZY'),
          faq_section(ORG_FAQ,m,ink=True),
          join_block('oTOZ5' if m else 'xNwt7','org',m,"Already connected? Log in",None,"Apply as an organization","See Buzz for brands"),
          clone('eeFE0' if m else 'yBWvN')]
    return secs

def brands(mobile):
    m=mobile
    secs=[hero('qDMTv' if m else 'R5ILF',ENT,"Authentic college\nmarketing,\nat scale.","BUZZ connects brands with student organizations to execute large-scale campus activations nationwide.","Apply as a brand","Epsilon Nu Tau x UPDATE",m,dock="Apply as a brand"),
          statement('n69XHO' if m else 'GRA5A',"You request a call.","Buzz mints and publishes the drop."),
          section('How it works',[mkhead("How it works","Request a campaign. Buzz runs the drop. Organizations post.",m),FR('Gap',width=10,height=48),cards(BSTEPS,m)],tight=True),
          goals_section(m),
          clone('T7ULb' if m else 'AhvOv'),
          faq_section(BR_FAQ,m,ink=True),
          join_block('oTOZ5' if m else 'xNwt7','brand',m,None,"Already have an account? Log in","See Buzz for organizations","Apply as a brand"),
          clone('eeFE0' if m else 'yBWvN')]
    return secs

def build(fname,title,fn,navcta):
    fname=fname.replace('.pen',SUF+'.pen')
    comps=lay_components(existing_components()+comp_defs())
    d=page(f'{title} / Desktop 1440',1440,fn(False),False,nav(False,navcta),0,0)
    mo=page(f'{title} / Mobile 390',390,fn(True),True,nav(True,None),1640,0)
    doc_=doc(comps+[d,mo]); json.dump(doc_,open(P+fname,'w'),indent=1,ensure_ascii=False)
    print('wrote',fname)
build('pulse-bee-orgs.pen','Pulse Bee Orgs',orgs,None)
build('pulse-bee-brands.pen','Pulse Bee Brands',brands,'Apply')
