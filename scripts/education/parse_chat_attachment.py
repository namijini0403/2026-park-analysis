"""Chat import: bounded extraction; original bytes are never written to disk."""
import base64, io, json, sys
from pathlib import Path
from parse_office_document import extract, MAX_BYTES, MAX_TEXT

if sys.platform!='win32':
    import resource
    resource.setrlimit(resource.RLIMIT_AS,(768*1024*1024,768*1024*1024))

def parse(name, data):
    if not data or len(data)>MAX_BYTES: raise ValueError('파일은 15MB 이하로 선택해 주세요.')
    if Path(name).suffix.lower()=='.pdf':
        from pypdf import PdfReader
        reader=PdfReader(io.BytesIO(data))
        if reader.is_encrypted: raise ValueError('암호를 해제한 PDF를 첨부해 주세요.')
        if len(reader.pages)>150: raise ValueError('PDF는 150페이지 이내로 나누어 주세요.')
        parts=[];size=0
        for i,page in enumerate(reader.pages):
            content=page.get_contents()
            if content is not None and len(content.get_data())>16*1024*1024: raise ValueError('PDF 페이지의 구성 내용이 너무 큽니다. 페이지를 단순화해 주세요.')
            text=page.extract_text() or '';size+=len(text)
            if size>MAX_TEXT: raise ValueError('추출 텍스트는 50만자 이내로 나누어 주세요.')
            if text.strip(): parts.append({'location':f'{i+1}페이지','text':text.strip()})
        if not parts: raise ValueError('텍스트가 없는 스캔 PDF입니다. OCR로 텍스트를 인식한 PDF 또는 TXT로 저장해 주세요.')
        return {'tables':[],'parts':parts,'warnings':['PDF는 페이지별 텍스트로 읽습니다. 표의 수치 연결은 Excel·CSV 원본으로 확인하세요.',f'전체 {len(reader.pages)}페이지 중 텍스트 추출 {len(parts)}페이지. 빈 페이지·이미지 속 글자는 분석에 포함되지 않습니다.']}
    result=extract(name,data)
    result['parts']=[{'location':f'본문 {i+1}문단','text':p} for i,p in enumerate(result.pop('paragraphs'))]
    return result

if __name__=='__main__':
    sys.stdin.reconfigure(encoding='utf-8');sys.stdout.reconfigure(encoding='utf-8')
    try:
        request=json.load(sys.stdin)
        print(json.dumps(parse(request['name'],base64.b64decode(request['base64'],validate=True)),ensure_ascii=False))
    except Exception as error:
        print(json.dumps({'error':str(error)},ensure_ascii=False));sys.exit(1)
