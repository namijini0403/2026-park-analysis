'use strict';
// Public portal pages for every analysis file. Used so that each answer, school summary and map layer links to the
// original open-data page instead of a local file path. Local paths stay available as technical detail only.
const OSM={url:'https://www.openstreetmap.org/copyright',title:'OpenStreetMap 보행망 · 기여자 라이선스(ODbL)',provider:'OpenStreetMap contributors'};
const SCHOOLINFO={url:'https://www.schoolinfo.go.kr/ng/go/pnnggo_a01_l2.do',title:'학교알리미 공시 정보',provider:'교육부 학교알리미'};
const KINDERINFO={url:'https://e-childschoolinfo.moe.go.kr/openData.do',title:'유치원알리미 공개 데이터',provider:'교육부 유치원알리미'};
const PARKS={url:'https://www.data.go.kr/data/15012890/standard.do',title:'전국도시공원정보표준데이터',provider:'공공데이터포털(지자체 제공)'};
const SCHOOLS={url:'https://www.data.go.kr/data/15021148/standard.do',title:'전국초중등학교위치표준데이터',provider:'공공데이터포털(교육부)'};
const LIB_STD={url:'https://www.data.go.kr/data/15013109/standard.do',title:'전국도서관표준데이터',provider:'문화체육관광부 · 공공데이터포털'};
const SCHOOL_LIB={url:'https://kess.kedi.re.kr/post/6670396',title:'초·중·고 학교도서관 현황(학교별) · KESS',provider:'교육부 · 한국교육개발원'};
const SCHOOL_LIB_PORTAL={url:'https://www.data.go.kr/data/15040972/fileData.do',title:'교육부_초중고 학교도서관 현황_학교별 · 공공데이터포털',provider:'교육부'};
const JUMIN={url:'https://jumin.mois.go.kr/ageStatMonth.do',title:'주민등록 인구통계 · 연령별 인구',provider:'행정안전부'};
const ZONES={url:'https://schoolzone.emac.kr/publicData/publicDataList.do',title:'학구도 공개자료',provider:'한국교육시설안전원'};
const SERVICES={url:'https://www.ice.go.kr/ice/ad/func/spnt/spntList.do?mi=10916',title:'초등돌봄 · 방과후 시설 안내',provider:'인천광역시교육청'};
const ACADEMY={url:'https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?mi=11841&nttSn=3381948',title:'학원·교습소 등록 현황',provider:'인천광역시교육청'};
const REDEV=[{url:'https://www.data.go.kr/data/15055212/fileData.do',title:'인천광역시_도시 및 주거환경 정비사업 추진현황',provider:'인천광역시 · 공공데이터포털'},{url:'https://www.data.go.kr/data/15072776/fileData.do',title:'인천광역시_소규모주택정비추진현황',provider:'인천광역시 · 공공데이터포털'}];
const APT={url:'https://www.data.go.kr/data/15048743/fileData.do',title:'인천광역시_공동주택내 체육시설 정보제공(단지·세대수)',provider:'인천광역시 · 공공데이터포털'};
const CONSTRUCTION=[{url:'https://www.data.go.kr/data/15029299/fileData.do',title:'인천광역시 연수구_착공 신고 현황',provider:'연수구 · 공공데이터포털'},{url:'https://www.data.go.kr/data/15029300/fileData.do',title:'인천광역시 미추홀구_착공 신고 현황',provider:'미추홀구 · 공공데이터포털'},{url:'https://www.data.go.kr/data/15038929/fileData.do',title:'인천광역시 계양구_착공 신고 현황',provider:'계양구 · 공공데이터포털'}];
const NIGHTLIFE=[{url:'https://www.data.go.kr/data/15045018/fileData.do',title:'행정안전부_유흥주점 인허가 정보(LOCALDATA)',provider:'행정안전부 · 공공데이터포털'},{url:'https://www.data.go.kr/data/15045017/fileData.do',title:'행정안전부_단란주점 인허가 정보(LOCALDATA)',provider:'행정안전부 · 공공데이터포털'}];
const ACCIDENTS={url:'https://www.data.go.kr/data/15029185/standard.do',title:'교통사고다발지역표준데이터(도로교통공단)',provider:'도로교통공단 · 공공데이터포털'};
const DESIGNATIONS={url:'https://www.ice.go.kr/ice/na/ntt/selectNttList.do?mi=11841',title:'교육청 지정·선정 학교 공고(교육복지·미래교실·AI정보중심 등)',provider:'인천광역시교육청'};
const KESS_PROGRESSION={url:'https://kess.kedi.re.kr/contents/dataset?itemCode=04&menuId=m_02_04_03_02&tabId=m1',title:'교육통계 · 졸업 후 진로 현황',provider:'한국교육개발원 KESS'};
const files={
 'data_processed/education/analysis_dataset.json':[SCHOOLINFO,KINDERINFO,PARKS,OSM],
 'data_processed/education/school_statistics.json':[SCHOOLINFO,KINDERINFO],
 'data_processed/education/school_public_indicators.json':[SCHOOLINFO],
 'data_processed/education/enrollment_forecasts.json':[SCHOOLINFO,KINDERINFO],
 'data_processed/education/forecast_validation.json':[SCHOOLINFO,KINDERINFO],
 'data_processed/education/grade_cohort_scenarios.json':[SCHOOLINFO],
 'data_processed/education/school_age_demand.json':[JUMIN,OSM],
 'data_processed/education/candidate_demand_v2.json':[JUMIN,OSM,PARKS],
 'data_processed/education/regional_demography.json':[JUMIN],
 'data_processed/education/regional_age_forecasts.json':[JUMIN],
 'data_processed/education/regional_age_forecast_validation.json':[JUMIN],
 'data_processed/education/school_progression.json':[KESS_PROGRESSION],
 'data_processed/schools.csv':[SCHOOLS],
 'data_processed/parks.csv':[PARKS],
 'data_processed/geocoded_playground.csv':[OSM],
 'data_processed/education/shared_parks.json':[PARKS,SCHOOLINFO],
 'data_processed/education/field_verification.json':[PARKS],
 'data_processed/education/school_routes.json':[OSM,PARKS],
 'data_processed/education/route_review.json':[OSM,PARKS],
 'data_processed/education/hybrid_walk_review.json':[OSM,PARKS],
 'data_processed/education/road_resilience.json':[OSM],
 'data_processed/education/residential_scenario.json':[OSM,APT],
 'data_processed/education/walkshed_500m.geojson':[OSM],
 'data_processed/school_walkshed_500m_v3.geojson':[OSM],
 'data_processed/candidate_barrier_routes_by_school.json':[OSM],
 'data_processed/libraries.csv':[LIB_STD],
 'data_processed/school_library_access.csv':[SCHOOL_LIB,SCHOOL_LIB_PORTAL,LIB_STD],
 'data_processed/education/library_access_preview.json':[LIB_STD,JUMIN],
 'data_processed/student_services/priorities.json':[],
 'data_processed/student_services/facilities.json':[SERVICES],
 'data_processed/education/academies.json':[ACADEMY],
 'data_processed/education/academies_map.json':[ACADEMY],
 'data_processed/education/academy_clusters.json':[ACADEMY],
 'data_processed/education/school_zones.geojson':[ZONES],
 'data_processed/redevelopment_geocoded.csv':REDEV,
 'data_processed/redevelopment.csv':REDEV,
 'data_processed/large_apt_complexes_2025.csv':[APT],
 'data_processed/context/facilities_construction.geojson':CONSTRUCTION,
 'data_processed/context/facilities_nightlife.geojson':NIGHTLIFE,
 'data_processed/context/accidents_incheon.json':[ACCIDENTS],
 'data_processed/context/school_designations.json':[DESIGNATIONS],
 'data_processed/education/designation_diffusion.json':[DESIGNATIONS],
 'data_processed/education/school_analysis.json':[SCHOOLS,SCHOOLINFO,PARKS],
 'data_processed/context/education_school_evidence.json':[SCHOOLINFO,DESIGNATIONS],
};
const layers={parks:PARKS,playgrounds:OSM,libraries:LIB_STD,youth:SERVICES,care:SERVICES,sports:SERVICES,academies:ACADEMY,clusters:ACADEMY,apartments:APT,redevelopment:REDEV[0],construction:CONSTRUCTION[0],accidents:ACCIDENTS};
const shortTitle={[SCHOOLINFO.url]:'학교알리미',[KINDERINFO.url]:'유치원알리미',[PARKS.url]:'도시공원 표준데이터',[OSM.url]:'OpenStreetMap',[LIB_STD.url]:'도서관 표준데이터',[SCHOOL_LIB.url]:'학교도서관 현황(KESS)',[JUMIN.url]:'주민등록 인구통계'};
function forFile(file){return (files[file]||[]).map(o=>({...o,kind:'portal',reference_date:null,retrieved_at:null}));}
function forLayer(id){return layers[id]||null;}
module.exports={files,layers,forFile,forLayer,shortTitle,OSM,SCHOOLINFO,PARKS};
