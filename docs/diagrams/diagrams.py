#!/usr/bin/env python3
"""ER diagram and DFD levels 0, 1 and 2 for the Offerline application tracker."""
import math, pathlib

INK="#1c1a15"; MUTED="#5c5748"; SUBTLE="#736d5c"
RULE="#c2bba8"; FOREST="#1f5540"; VERM="#b93514"
FILL="#ffffff"; PAPER="#f4f2ed"; PANEL="#fdfbf7"
SANS="'Source Sans 3','Segoe UI',Helvetica,Arial,sans-serif"
MONO="'IBM Plex Mono',Consolas,'Courier New',monospace"
OUT = pathlib.Path(__file__).parent

class Svg:
    def __init__(s, w, h, aria):
        s.o=['<?xml version="1.0" encoding="UTF-8"?>',
             f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
             f'role="img" aria-label="{aria}">',
             f'<rect x="0" y="0" width="{w}" height="{h}" fill="{PANEL}"/>','<defs>',
             f'<marker id="a" viewBox="0 0 10 10" refX="9.2" refY="5" markerWidth="8" markerHeight="8" '
             f'orient="auto-start-reverse"><path d="M0.6,0.8 L9.4,5 L0.6,9.2" fill="none" stroke="{MUTED}" '
             f'stroke-width="1.7"/></marker>','</defs>']
    def add(s,x): s.o.append(x)
    def text(s,x,y,t,size=12.5,weight="400",fill=INK,anchor="middle",family=SANS,ls=None):
        e=f' letter-spacing="{ls}"' if ls else ""
        s.o.append(f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" '
                   f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{e}>{t}</text>')
    def save(s,name):
        s.o.append('</svg>'); (OUT/name).write_text("\n".join(s.o),encoding="utf-8"); print(name)

def esc(t): return t.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
def cpt(cx,cy,r,tx,ty):
    dx,dy=tx-cx,ty-cy; d=math.hypot(dx,dy) or 1; return (cx+dx/d*r, cy+dy/d*r)
def rpt(x,y,w,h,tx,ty):
    cx,cy=x+w/2,y+h/2; dx,dy=tx-cx,ty-cy
    if dx==0 and dy==0: return (cx,cy)
    sx=(w/2)/abs(dx) if dx else 1e9; sy=(h/2)/abs(dy) if dy else 1e9; s=min(sx,sy)
    return (cx+dx*s, cy+dy*s)

def arrow(g,p1,p2,col=MUTED):
    g.add(f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" stroke="{col}" '
          f'stroke-width="1.5" fill="none" marker-end="url(#a)"/>')
def poly(g,pts,col=MUTED):
    p=" ".join(f"{a:.1f},{b:.1f}" for a,b in pts)
    g.add(f'<polyline points="{p}" fill="none" stroke="{col}" stroke-width="1.5" '
          f'stroke-linejoin="round" marker-end="url(#a)"/>')
def lab(g,x,y,lines,anchor="middle",col=MUTED):
    for i,t in enumerate(lines.split("|")):
        g.text(x,y+i*14,esc(t),size=11.5,fill=col,anchor=anchor)

def ext(g,x,y,w,h,label,dup=False):
    g.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{FILL}" stroke="{INK}" stroke-width="1.6"/>')
    if dup: g.add(f'<path d="M{x} {y+16} L{x+16} {y}" stroke="{INK}" stroke-width="1.6"/>')
    ls=label.split("|"); y0=y+h/2-(len(ls)-1)*9+4
    for i,t in enumerate(ls): g.text(x+w/2,y0+i*18,esc(t),size=12.5,weight="600")
    return (x,y,w,h)

def proc(g,cx,cy,r,num,label):
    g.add(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{PAPER}" stroke="{FOREST}" stroke-width="1.8"/>')
    g.add(f'<path d="M{cx-r*0.86:.1f} {cy-r*0.45:.1f} A {r} {r} 0 0 1 {cx+r*0.86:.1f} {cy-r*0.45:.1f}" '
          f'fill="none" stroke="{FOREST}" stroke-width="1.1" opacity="0.45"/>')
    g.text(cx,cy-r*0.56+4,num,size=11.5,weight="600",fill=FOREST,family=MONO)
    ls=label.split("|"); y0=cy+8-(len(ls)-1)*8
    for i,t in enumerate(ls): g.text(cx,y0+i*16,esc(t),size=12)
    return (cx,cy,r)

def store(g,x,y,w,sid,label):
    h=40
    g.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{FILL}" stroke="none"/>')
    g.add(f'<path d="M{x} {y} H{x+w} M{x} {y+h} H{x+w} M{x} {y} V{y+h} M{x+42} {y} V{y+h}" '
          f'stroke="{INK}" stroke-width="1.6" fill="none"/>')
    g.text(x+21,y+h/2+4,sid,size=11,weight="600",fill=VERM,family=MONO)
    g.text(x+42+(w-42)/2,y+h/2+4,esc(label),size=12.5)
    return (x,y,w,h)

def head(g,t,sub):
    g.text(48,48,t,size=17,weight="600",anchor="start")
    g.text(48,70,sub,size=11.5,fill=SUBTLE,anchor="start")

def legend(g,y,dup=False):
    g.add(f'<rect x="48" y="{y}" width="26" height="18" rx="4" fill="{FILL}" stroke="{INK}" stroke-width="1.4"/>')
    g.text(84,y+13,"external entity",size=11.5,fill=MUTED,anchor="start")
    g.add(f'<circle cx="218" cy="{y+9}" r="10" fill="{PAPER}" stroke="{FOREST}" stroke-width="1.5"/>')
    g.text(236,y+13,"process",size=11.5,fill=MUTED,anchor="start")
    g.add(f'<path d="M300 {y} H352 M300 {y+18} H352 M300 {y} V{y+18} M312 {y} V{y+18}" '
          f'stroke="{INK}" stroke-width="1.4" fill="none"/>')
    g.text(362,y+13,"data store",size=11.5,fill=MUTED,anchor="start")
    if dup:
        g.add(f'<rect x="450" y="{y}" width="26" height="18" rx="4" fill="{FILL}" stroke="{INK}" stroke-width="1.4"/>')
        g.add(f'<path d="M450 {y+10} L460 {y}" stroke="{INK}" stroke-width="1.4"/>')
        g.text(486,y+13,"repeated entity",size=11.5,fill=MUTED,anchor="start")

# ══════════════════════════════ ER DIAGRAM ══════════════════════════════
def er():
    g=Svg(1440,950,"Entity relationship diagram for the Offerline application tracker.")
    head(g,"Offerline: entity relationship diagram",
         "PK primary key, FK foreign key, UQ unique constraint. Cardinalities are shown at each end of the relationship.")
    E={}
    def entity(k,x,y,w,title,rows):
        hh=34+len(rows)*19+12
        g.add(f'<rect x="{x}" y="{y}" width="{w}" height="{hh}" rx="8" fill="{FILL}" stroke="{RULE}" stroke-width="1.5"/>')
        g.add(f'<path d="M{x+8} {y} H{x+w-8} A8 8 0 0 1 {x+w} {y+8} V{y+34} H{x} V{y+8} A8 8 0 0 1 {x+8} {y} Z" fill="{PAPER}"/>')
        g.add(f'<path d="M{x} {y+34} H{x+w}" stroke="{RULE}" stroke-width="1.5"/>')
        g.text(x+14,y+23,title,size=12.5,weight="600",anchor="start",ls="0.9")
        for i,(tag,name) in enumerate(rows):
            ty=y+34+19*(i+1)-4
            if tag:
                c=FOREST if tag=="PK" else (VERM if tag=="UQ" else MUTED)
                g.text(x+14,ty,tag,size=10,weight="500",fill=c,anchor="start",family=MONO)
            g.text(x+46,ty,esc(name),size=11.5,anchor="start")
        E[k]=(x,y,w,hh)
    entity("USER",60,110,300,"USER",[("PK","userId"),("","email"),("","fullName"),("","role"),
        ("","phone"),("","skills"),("","profilePicUrl"),("","academicInfo"),("","transcriptS3Key"),("","createdAt")])
    entity("NOTIF",560,110,340,"NOTIFICATION",[("PK","userId + createdAt"),("FK","userId"),
        ("","notificationId"),("","type"),("","message, link"),("","read"),("","expiresAt")])
    entity("COMP",1080,110,300,"COMPANY",[("PK","companyId"),("","companyName"),("","contactEmail"),
        ("","companyWebsiteUrl"),("","officeAddress"),("","googleMapsUrl"),("","verificationStatus"),
        ("FK","verifiedBy"),("","verifiedAt"),("","createdAt")])
    entity("CV",60,430,300,"CV",[("PK","cvId"),("FK","userId"),("","label"),("","s3Key"),("","uploadedAt")])
    entity("JOB",1080,400,300,"JOB",[("PK","jobId"),("FK","companyId"),("","title, description"),
        ("","opportunityType"),("","workModality"),("","postingStatus"),("","applicationDeadline"),
        ("","documentRequirements"),("","salary, city, country"),("","experienceLevel"),("","createdAt")])
    entity("APP",560,430,340,"APPLICATION",[("PK","applicationId"),("FK","applicantId"),("FK","jobId"),
        ("FK","cvId"),("","companyId, opportunityType"),("","status"),("","documents"),("","coverLetter"),
        ("","appliedAt, lastEditedAt"),("UQ","(applicantId, jobId)")])
    entity("HIST",60,720,300,"STATUS_ENTRY",[("PK","entryId"),("FK","applicationId"),("","status"),
        ("","changedBy"),("","note"),("","timestamp")])
    entity("INT",1080,720,300,"INTERVIEW",[("PK","interviewId"),("FK","applicationId"),("","scheduledAt"),
        ("","durationMinutes"),("","mode"),("","locationOrLink"),("","state")])

    def rel(a,b,verb,ca,cb,lx,ly,sa=(0,0),sb=(0,0)):
        ax,ay,aw,ah=E[a]; bx,by,bw,bh=E[b]
        p1=rpt(ax,ay,aw,ah,bx+bw/2,by+bh/2); p2=rpt(bx,by,bw,bh,ax+aw/2,ay+ah/2)
        arrow(g,p1,p2); lab(g,lx,ly,verb)
        g.text(p1[0]+sa[0],p1[1]+sa[1],ca,size=11,weight="600",fill=FOREST)
        g.text(p2[0]+sb[0],p2[1]+sb[1],cb,size=11,weight="600",fill=FOREST)

    poly(g,[(210,110),(210,86),(1230,86),(1230,110)]); lab(g,720,80,"verifies")
    g.text(226,104,"1",size=11,weight="600",fill=FOREST)
    g.text(1214,104,"N",size=11,weight="600",fill=FOREST)

    rel("USER","NOTIF","receives","1","N",460,272,(16,-8),(-16,-8))
    rel("USER","CV","owns","1","N",236,368,(16,16),(16,-8),)
    rel("USER","APP","submits","1","N",470,512,(16,-4),(-18,-6))
    rel("COMP","JOB","publishes","1","N",1300,368,(16,16),(16,-8))
    rel("JOB","APP","receives","1","N",990,458,(-20,-8),(20,-8))
    rel("CV","APP","attached to","1","0..N",470,690,(16,-8),(-26,-8))
    rel("APP","HIST","records","1","1..N",470,912,(-6,18),(20,-12))
    rel("APP","INT","schedules","1","0..N",990,912,(4,18),(-28,-12))
    g.save("offerline-er-diagram.svg")

# ══════════════════════════════ DFD LEVEL 0 ══════════════════════════════
def dfd0():
    g=Svg(1400,820,"Context level data flow diagram for the Offerline application tracker.")
    head(g,"Offerline: data flow diagram, level 0 (context)",
         "One process, five external entities, and the data that crosses the system boundary.")
    proc(g,700,430,125,"0","Offerline|Application|Tracker")
    ext(g,60,385,200,90,"Applicant"); ext(g,1140,385,200,90,"Recruiter|(company account)")
    ext(g,600,90,200,80,"Admin"); ext(g,110,660,190,76,"Google OAuth"); ext(g,1100,660,190,76,"Email service")

    arrow(g,(260,398),(579,398)); lab(g,420,344,"registration, profile and CV|application and document keys|offer and interview replies")
    arrow(g,(579,462),(260,462)); lab(g,420,482,"matching postings|application status|notifications")
    arrow(g,(1140,398),(821,398)); lab(g,980,344,"company details and postings|status decisions, interview details|export request")
    arrow(g,(821,462),(1140,462)); lab(g,980,482,"applications and documents|new application alerts|analytics and CSV export")
    arrow(g,(660,170),(660,312)); lab(g,648,228,"verification and|suspension decisions",anchor="end")
    arrow(g,(740,312),(740,170)); lab(g,752,228,"pending companies|and reports",anchor="start")
    arrow(g,(275,660),(590,490)); lab(g,424,552,"identity assertion")
    arrow(g,(810,490),(1125,660)); lab(g,962,546,"status emails and|calendar invitations")
    legend(g,764)
    g.save("offerline-dfd-level0.svg")

# ══════════════════════════════ DFD LEVEL 1 ══════════════════════════════
def dfd1():
    g=Svg(1540,1310,"Level 1 data flow diagram for the Offerline application tracker.")
    head(g,"Offerline: data flow diagram, level 1",
         "The context process decomposed into seven processes and seven data stores. Each process holds one band.")

    ext(g,40,120,170,58,"Google OAuth")
    APL=ext(g,40,460,170,70,"Applicant",dup=True)
    ext(g,40,630,170,80,"Applicant")
    ext(g,1300,60,170,66,"Admin")
    ext(g,1300,470,170,80,"Recruiter")
    ext(g,1300,1150,170,64,"Email service")

    proc(g,520,150,58,"1.0","Manage|identity")
    proc(g,520,320,58,"2.0","Manage|companies")
    proc(g,520,490,58,"3.0","Manage|postings")
    proc(g,520,660,66,"4.0","Process|applications")
    proc(g,520,830,58,"5.0","Manage|interviews")
    proc(g,520,1000,58,"6.0","Analytics|and export")
    proc(g,520,1170,58,"7.0","Dispatch|notifications")

    store(g,820,130,220,"D1","Users");            store(g,820,300,220,"D2","Companies")
    store(g,820,470,220,"D3","Jobs");             store(g,820,560,220,"D7","Submission queue")
    store(g,820,640,220,"D4","Applications");     store(g,820,720,220,"D6","Documents")
    store(g,820,1150,220,"D5","Notifications")

    # 1.0
    arrow(g,(210,149),(463,142)); lab(g,336,132,"identity assertion")
    poly(g,[(210,650),(296,650),(296,158),(463,158)]); lab(g,288,392,"credentials",anchor="end")
    poly(g,[(463,170),(312,170),(312,662),(210,662)]); lab(g,322,566,"session token",anchor="start")
    arrow(g,(578,150),(820,150)); lab(g,699,138,"user record")
    # 2.0
    poly(g,[(1300,105),(1276,105),(1276,240),(520,240),(520,262)]); lab(g,880,232,"verification decision")
    poly(g,[(1300,490),(1290,490),(1290,282),(560,282),(560,278)]); lab(g,900,274,"company details")
    arrow(g,(578,320),(820,320)); lab(g,699,308,"company record")
    # 3.0
    poly(g,[(1300,510),(1262,510),(1262,452),(564,452)]); lab(g,900,444,"posting details")
    arrow(g,(578,490),(820,490)); lab(g,699,478,"posting record")
    arrow(g,(210,482),(462,486)); lab(g,340,452,"search filters")
    arrow(g,(462,500),(210,512)); lab(g,340,534,"matching postings")
    # 4.0
    arrow(g,(210,648),(454,652)); lab(g,332,620,"application and|document keys")
    arrow(g,(454,676),(210,692)); lab(g,332,714,"status and receipt")
    arrow(g,(586,660),(820,660)); lab(g,700,674,"application record")
    arrow(g,(585,647),(818,578)); lab(g,690,592,"queued submission")
    arrow(g,(818,592),(590,654)); lab(g,700,644,"polled message")
    arrow(g,(578,700),(820,730)); lab(g,700,748,"document keys")
    poly(g,[(462,690),(300,690),(300,1170),(462,1170)]); lab(g,310,944,"status change event",anchor="start")
    # 5.0
    poly(g,[(1300,530),(1170,530),(1170,830),(578,830)]); lab(g,900,822,"interview details")
    arrow(g,(574,808),(882,680)); lab(g,742,724,"interview entry")
    # 6.0
    poly(g,[(1300,550),(1290,550),(1290,1000),(578,1000)]); lab(g,900,992,"export request")
    poly(g,[(578,1014),(1276,1014),(1276,568),(1300,568)]); lab(g,900,1028,"analytics and CSV export")
    poly(g,[(838,682),(838,704),(700,704),(700,930),(520,930),(520,942)]); lab(g,712,860,"application data",anchor="start")
    # 7.0
    poly(g,[(462,1184),(336,1184),(336,842),(462,842)]); lab(g,346,1030,"invitation event",anchor="start")
    arrow(g,(578,1170),(820,1170)); lab(g,699,1158,"notification record")
    poly(g,[(520,1228),(1385,1228),(1385,1216)]); lab(g,950,1220,"emails and calendar invitations")
    legend(g,1262,dup=True)
    g.save("offerline-dfd-level1.svg")

# ══════════════════════════════ DFD LEVEL 2 ══════════════════════════════
def dfd2():
    g=Svg(1450,1000,"Level 2 data flow diagram decomposing process 4.0, process applications.")
    head(g,"Offerline: data flow diagram, level 2 (process 4.0, process applications)",
         "The application pipeline, from the presigned upload to a recorded status change.")

    ext(g,40,400,170,90,"Applicant"); ext(g,40,840,170,80,"Recruiter")
    ext(g,1180,660,190,74,"AWS Secrets|Manager"); ext(g,1180,840,190,74,"7.0 Dispatch|notifications")

    proc(g,390,160,56,"4.1","Issue upload|URL")
    proc(g,390,430,56,"4.2","Validate|submission")
    proc(g,660,430,56,"4.3","Record|application")
    proc(g,930,430,56,"4.4","Enqueue|submission")
    proc(g,930,680,56,"4.5","Parse|documents")
    proc(g,390,680,56,"4.6","Amend|application")
    proc(g,660,870,56,"4.7","Change|status")

    store(g,600,140,200,"D6","Documents"); store(g,600,260,200,"D3","Jobs")
    store(g,600,560,200,"D4","Applications"); store(g,1180,410,200,"D7","Submission queue")

    arrow(g,(210,420),(352,201)); lab(g,322,252,"upload request",anchor="end")
    arrow(g,(346,213),(210,436)); lab(g,232,352,"presigned URL",anchor="start")
    arrow(g,(446,160),(600,160)); lab(g,523,148,"object key")
    arrow(g,(210,450),(336,436)); lab(g,272,404,"payload and|document keys")
    arrow(g,(600,280),(440,406)); lab(g,524,326,"document requirements")
    arrow(g,(446,430),(604,430)); lab(g,525,418,"validated application")
    arrow(g,(660,486),(660,560)); lab(g,675,508,"SUBMITTED record|and first history entry",anchor="start")
    arrow(g,(716,430),(874,430)); lab(g,795,418,"stored application")
    arrow(g,(986,430),(1180,430)); lab(g,1083,418,"queued message")
    arrow(g,(1280,450),(977,649)); lab(g,1152,516,"polled message")
    arrow(g,(1180,690),(986,684)); lab(g,1083,668,"parser credentials")
    poly(g,[(907,629),(560,629),(560,172),(600,172)]); lab(g,548,330,"stored document",anchor="end")
    arrow(g,(879,658),(746,600)); lab(g,806,672,"parsed fields",anchor="end")
    arrow(g,(125,490),(344,647)); lab(g,196,586,"amendment|(while SUBMITTED)",anchor="start")
    arrow(g,(443,663),(638,600)); lab(g,492,614,"revised keys")
    arrow(g,(210,870),(604,870)); lab(g,400,858,"status decision")
    arrow(g,(660,814),(660,600)); lab(g,675,698,"new status and|history entry",anchor="start")
    arrow(g,(716,871),(1180,876)); lab(g,940,860,"status change event")
    arrow(g,(980,709),(1210,840)); lab(g,1078,746,"alert event")
    legend(g,946)
    g.save("offerline-dfd-level2.svg")

er(); dfd0(); dfd1(); dfd2()
