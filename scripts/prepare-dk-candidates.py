"""Offline source capture adapter. Writes candidate JSON only; never connects to Google/Orbit."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--snapshot', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--captured-at', required=True, help='Actual capture time with timezone; do not infer from a date-only snapshot')
args = parser.parse_args()
book = json.loads(args.snapshot.read_text(encoding='utf-8'))
rows = []
def value(r, i):
    return r['values'][i] if i < len(r['values']) else None
for s in book['sheets']:
    for r in s['rows']:
        sid, row = s['sheetId'], r['row']
        if sid == 1006321103 and 3 <= row <= 12:
            rows.append({'sheetId':sid,'row':row,'kind':'site','values':{'name':value(r,1),'sourceLabel':value(r,9),'sourceRoomCount':value(r,4)}})
        elif sid == 1903270638 and row >= 4 and value(r,1) and value(r,3):
            rows.append({'sheetId':sid,'row':row,'kind':'room','values':{'name':value(r,3),'siteLabel':value(r,1),'numberText':value(r,6),'areaM2':value(r,5),'photoReference':value(r,9),'drawingReference':value(r,10)}})
        elif sid == 2063224204 and row >= 3 and value(r,2):
            rows.append({'sheetId':sid,'row':row,'kind':'requirement','values':{'name':value(r,2),'specification':value(r,3),'unit':value(r,6),'quantity':value(r,4),'proposedQuantity':value(r,5),'sourceCustomerAmount':value(r,9),'mappingStatus':'room-allocation-and-baseline-review-required'}})
        elif sid == 229395414 and row >= 4:
            dated = {f'column_{i+1}':v for i,v in enumerate(r['values']) if i >= 27 and v not in (None,'')}
            if dated:
                header = next(item for item in s['rows'] if item['row'] == 3)
                dated.update({f'date_{i+1}':value(header,i) for i,v in enumerate(r['values']) if i >= 27 and v not in (None,'')})
                rows.append({'sheetId':sid,'row':row,'kind':'payment','values':{'name':value(r,3),'category':value(r,2),'contractReference':value(r,5),'sourceTotalKZT':value(r,26),**dated}})

args.output.mkdir(parents=True,exist_ok=True)
chunks, current = [], []
for row in rows:
    trial = current + [row]
    if len(trial) > 1500 or len(json.dumps(trial,ensure_ascii=False).encode()) > 1500000:
        chunks.append(current); current = [row]
    else: current = trial
if current: chunks.append(current)
for i, chunk in enumerate(chunks,1):
    payload = {'sourceBookId':'1VBzRLyEU_TWRJdTQUe-HA4okpfgSgVMjtVwZhFZbyDM','capturedAt':args.captured_at,'captureMode':'sequential','rows':chunk}
    target = args.output / f'dk-candidates-{i:03}.json'
    if target.exists(): raise SystemExit(f'Output already exists: {target}. Choose a fresh capture folder.')
    target.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'candidateRows':len(rows),'files':len(chunks),'approved':False,'sourceWriteAllowed':False,'snapshotSha256':hashlib.sha256(args.snapshot.read_bytes()).hexdigest()}))
