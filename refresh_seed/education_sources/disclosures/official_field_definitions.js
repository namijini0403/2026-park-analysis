/**
 * table Header 정보
 * 학교급 정보
 * @param goNo
 */
function setHeadData(goNo, pbanYr, shlKndScCd) {
	// 테이블 기본 헤더칼럼
	var baseColumns = [{ label : "시도교육청", column : "ATPT_OFCDC_ORG_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
					, { label : "교육지원청", column : "JU_ORG_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
					, { label : "지역", column : "ADRCD_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
					, { label : "정보공시 학교코드", column : "SCHUL_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
					, { label : "학교명", column : "SCHUL_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
					, { label : "학교급코드", column : "SCHUL_KND_SC_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
					, { label : "학교과정구분", column : "SCHUL_CRSE_SC_VALUE_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
					, { label : "설립구분", column : "FOND_SC_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
					, { label : "제외여부", column : "PBAN_EXCP_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
					, { label : "제외사유", column : "PBAN_EXCP_RSN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
	
	// 기본 학교급 세팅
/*	
	baseSchulKnd = { 
			  "02" : { label : "초등학교"	, use : "Y" }
			, "03" : { label : "중학교"	, use : "Y" }
			, "04" : { label : "고등학교"	, use : "Y" }
			, "05" : { label : "특수학교"	, use : "Y" }
			, "06" : { label : "그외학교"	, use : "Y" }
			, "07" : { label : "각종학교"	, use : "Y" }
	};
*/
	
	baseLctnScCode = { 
			 '0': {  value : '0', label : '전체', use : 'Y' }
			,'1': { value : '01', label : '서울특별시교육청', use : 'Y', }
			,'2': { value : '05', label : '전남광주통합특별시교육청', use : 'Y' }
			,'3': { value : '02', label : '부산광역시교육청', use : 'Y' }
			,'4': { value : '03', label : '대구광역시교육청', use : 'Y' }
			,'5': { value : '04', label : '인천광역시교육청', use : 'Y' }
			,'6': { value : '06', label : '대전광역시교육청', use : 'Y' }
			,'7': { value : '07', label : '울산광역시교육청', use : 'Y' }
			,'8': { value : '08', label : '세종특별자치시교육청', use : 'Y' }
			,'9': { value : '10', label : '경기도교육청', use : 'Y' }
			,'10': { value : '12', label : '충청북도교육청', use : 'Y' }
			,'11': { value : '13', label : '충청남도교육청', use : 'Y' }
			,'12': { value : '16', label : '경상북도교육청', use : 'Y' }
			,'13': { value : '17', label : '경상남도교육청', use : 'Y' }
			,'14': { value : '18', label : '제주특별자치도교육청', use : 'Y' }
			,'15': { value : '11', label : '강원특별자치도교육청', use : 'Y' }
			,'16': { value : '14', label : '전북특별자치도교육청', use : 'Y' }
	};
	 
	switch(goNo) {
		case "0" : // 학교 기본정보
			var columns = [{ label : "시도교육청"		, column : "ATPT_OFCDC_ORG_NM"	, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교육지원청"		, column : "JU_ORG_NM"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "지역"			, column : "ADRCD_NM"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "정보공시 학교코드"	, column : "SCHUL_CODE"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학교명"			, column : "SCHUL_NM"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학교급코드"		, column : "SCHUL_KND_SC_CODE"	, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학교과정구분"		, column : "SCHUL_CRSE_SC_VALUE_NM"	, index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "설립구분"		, column : "FOND_SC_CODE"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학교특성"		, column : "HS_KND_SC_NM"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "분교여부"		, column : "BNHH_YN"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "설립유형"		, column : "SCHUL_FOND_TYP_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "주야구분"		, column : "DGHT_SC_CODE"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "개교기념일"		, column : "FOAS_MEMRD"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "설립일"			, column : "FOND_YMD"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "법정동코드"		, column : "ADRCD_ID"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "주소내역"		, column : "ADRES_BRKDN"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "상세주소내역"		, column : "DTLAD_BRKDN"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "우편번호"		, column : "ZIP_CODE"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학교도로명 우편번호", column : "SCHUL_RDNZC"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학교도로명 주소"	, column : "SCHUL_RDNMA"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학교도로명 상세주소", column : "SCHUL_RDNDA"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "위도"			, column : "LTTUD"				, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "경도"			, column : "LGTUD"				, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전화번호"		, column : "USER_TELNO"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "팩스번호"		, column : "PERC_FAXNO"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "홈페이지 주소"		, column : "HMPG_ADRES"			, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "남녀공학 구분"		, column : "COEDU_SC_CODE"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "폐교여부"		, column : "ABSCH_YN"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "폐교일자"		, column : "ABSCH_YMD"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "휴교여부"		, column : "CLOSE_YN"		, index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			
			break;
		
		case "08"://08	수업일수 및 수업시수 현황
			var columns = [{ label : "1학년"					, column : "COL_1"					, index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "2학년"					, column : "COL_2"					, index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "3학년"					, column : "COL_3"					, index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "4학년"					, column : "COL_4"					, index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "5학년"					, column : "COL_5"					, index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "6학년"					, column : "COL_6"					, index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "주당평균수업시수(교사 1인당)"	, column : "PER_STUDAY_DAY"			, index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,05", startDate : "", endDate : "", kind : "" }
						, { label : "주당수업시수"				, column : "WEEK_TOT_ITRT_HR_FGR"	, index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,05", startDate : "", endDate : "", kind : "" }
						, { label : "수업교원수"				, column : "ITRT_TCR_TOT_FGR"		, index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,05", startDate : "", endDate : "", kind : "" }
						, { label : "학교과정구분"				, column : "SCHUL_CRSE_SC_CODE_P"	, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "1학년"					, column : "COL_1_P"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "2학년"					, column : "COL_2_P"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "3학년"					, column : "COL_3_P"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "4학년"					, column : "COL_4_P"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "5학년"					, column : "COL_5_P"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "6학년"					, column : "COL_6_P"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "학교과정구분"				, column : "SCHUL_CRSE_SC_CODE_M"	, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "1학년"					, column : "COL_1_M"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "2학년"					, column : "COL_2_M"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "3학년"					, column : "COL_3_M"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "학교과정구분"				, column : "SCHUL_CRSE_SC_CODE_H"	, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "1학년"					, column : "COL_1_H"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "2학년"					, column : "COL_2_H"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "3학년"					, column : "COL_3_H"				, index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			baseSchulKnd["06"]["use"] = "N"; // 그외학교 사용 안함
			baseSchulKnd["07"]["use"] = "N"; // 각종학교 사용 안함
			
			if(shlKndScCd == "02"){ //초등학교
				unitText = "1학년/2학년/3학년/4학년/5학년/6학년 - 일, 주당평균수업시수(교사1인당)/주당수업시수  - 1시수 : 40분으로 환산, 수업교원수 - 명";
			}if(shlKndScCd == "03"){ //중학교
				unitText = "1학년/2학년/3학년 - 일, 주당평균수업시수(교사1인당)/주당수업시수  - 1시수 : 45분으로 환산, 수업교원수 - 명";
			}if(shlKndScCd == "04"){ //고등학교
				unitText = "1학년/2학년/3학년 - 일, 주당평균수업시수(교사1인당)/주당수업시수  - 1시수 : 50분으로 환산, 수업교원수 - 명";
			}if(shlKndScCd == "05"){ //특수학교
				unitText = "주당평균수업시수(교사1인당)/주당수업시수  - 1시수 : 40분으로 환산, 수업교원수 - 명, 1학년/2학년/3학년/4학년/5학년/6학년 - 일";
			}
			
			break;
				
		case "67"://67	교육운영 특색사업 계획
			var columns;
			if(pbanYr >= 2022 && shlKndScCd == '02'){
				columns = [{ label : "자율학교(지정·운영)", column : "SLCTL_SCHUL_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수준별 수업(운영)", column : "LEVEL_ACCTO_MVMN_ITRT_OPRTN_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "영어교육프로그램(운영)", column : "ENGL_EDC_PGM_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2015", endDate : "2020", kind : "" }];
			}else{
				columns = [{ label : "교과교실제(지정·운영)", column : "CURR_CCCLA_SYST_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "자율학교(지정·운영)", column : "SLCTL_SCHUL_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수준별 수업(운영)", column : "LEVEL_ACCTO_MVMN_ITRT_OPRTN_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "영어교육프로그램(운영)", column : "ENGL_EDC_PGM_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2015", endDate : "2020", kind : "" }];
			}
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			
			break;
			
		case "62"://62	학교 현황
			var columns = [{ label : "1학년", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "2학년", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "3학년", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "4학년", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "5학년", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "6학년", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "특수학급", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "순회학급", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "학급수(계)", column : "COL_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "학생수(계)", column : "COL_FGR_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "학급당학생수", column : "AVG_FGR_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유-순회", column : "COL_S1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-1학년", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-2학년", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-3학년", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-4학년", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-5학년", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-6학년", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-초-순회", column : "COL_S2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-학급수계", column : "COL_SUM_1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-학생수계", column : "COL_SUM_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-학급당학생수", column : "AVG_SUM_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년", column : "COL_9", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년", column : "COL_10", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회", column : "COL_S3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-학급수계", column : "COL_SUM_2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-학생수계", column : "COL_SUM_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-학급당학생수", column : "AVG_SUM_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년", column : "COL_11", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년", column : "COL_12", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년", column : "COL_13", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회", column : "COL_S4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-학급수계", column : "COL_SUM_3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-학생수계", column : "COL_SUM_FGR3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-학급당학생수", column : "AVG_SUM_FGR3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "전공과", column : "COL_14", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "학급수 총계", column : "COL_SUM_4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : ""  }
						, { label : "학생수 총계", column : "COL_SUM_FGR4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : ""  }
						, { label : "학급당학생수", column : "AVG_SUM_FGR4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-1학년", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-2학년", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-3학년", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-4학년", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-5학년", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-6학년", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-순회", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-특수", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-학급수계", column : "COL_SUM_1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-학생수계", column : "COL_SUM_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-학급당학생수", column : "AVG_SUM_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년", column : "COL_9", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년", column : "COL_10", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년", column : "COL_11", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회", column : "COL_12", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-특수", column : "COL_13", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-학급수계", column : "COL_SUM_2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-학생수계", column : "COL_SUM_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-학급당학생수", column : "AVG_SUM_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년", column : "COL_14", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년", column : "COL_15", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년", column : "COL_16", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회", column : "COL_17", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-특수", column : "COL_18", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-학급수계", column : "COL_SUM_3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-학생수계", column : "COL_SUM_FGR3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-학급당학생수", column : "AVG_SUM_FGR3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "학급수 총계", column : "COL_SUM_4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : ""  }
						, { label : "학생수 총계", column : "COL_SUM_FGR4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : ""  }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];

			unitText = "개, 학생수 - 명";
			
			break;
			
		case "63"://63	성별 학생수
			var columns = [{ label : "1학년(남)", column : "COL_M1", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "1학년(여)", column : "COL_W1", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "2학년(남)", column : "COL_M2", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "2학년(여)", column : "COL_W2", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "3학년(남)", column : "COL_M3", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "3학년(여)", column : "COL_W3", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "4학년(남)", column : "COL_M4", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "4학년(여)", column : "COL_W4", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "5학년(남)", column : "COL_M5", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "5학년(여)", column : "COL_W5", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "6학년(남)", column : "COL_M6", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "6학년(여)", column : "COL_W6", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "특수학급(남)", column : "COL_M7", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "특수학급(여)", column : "COL_W7", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "순회학급(남)", column : "COL_M8", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "순회학급(여)", column : "COL_W8", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "계(남)", column : "COL_MSUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "계(여)", column : "COL_WSUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "총계", column : "SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유(남)", column : "COL_M1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유(여)", column : "COL_W1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유-순회(남)", column : "COL_SM1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유-순회(여)", column : "COL_SW1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-1학년(남)", column : "COL_M2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-1학년(여)", column : "COL_W2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-2학년(남)", column : "COL_M3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-2학년(여)", column : "COL_W3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-3학년(남)", column : "COL_M4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-3학년(여)", column : "COL_W4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-4학년(남)", column : "COL_M5", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-4학년(여)", column : "COL_W5", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-5학년(남)", column : "COL_M6", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-5학년(여)", column : "COL_W6", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-6학년(남)", column : "COL_M7", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-6학년(여)", column : "COL_W7", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-초-순회(남)", column : "COL_SM2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-초-순회(여)", column : "COL_SW2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-계(남)", column : "COL_MSUM1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-계(여)", column : "COL_WSUM1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년(남)", column : "COL_M8", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년(여)", column : "COL_W8", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년(남)", column : "COL_M9", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년(여)", column : "COL_W9", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년(남)", column : "COL_M10", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년(여)", column : "COL_W10", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회(남)", column : "COL_SM3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회(여)", column : "COL_SW3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-계(남)", column : "COL_MSUM2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-계(여)", column : "COL_WSUM2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년(남)", column : "COL_M11", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년(여)", column : "COL_W11", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년(남)", column : "COL_M12", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년(여)", column : "COL_W12", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년(남)", column : "COL_M13", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년(여)", column : "COL_W13", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회(남)", column : "COL_SM4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회(여)", column : "COL_SW4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-계(남)", column : "COL_MSUM3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-계(여)", column : "COL_WSUM3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "전공과(남)", column : "COL_M14", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "전공과(여)", column : "COL_W14", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "총계(남)", column : "COL_MSUM4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "총계(여)", column : "COL_WSUM4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "합계", column : "COL_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-1학년(남)", column : "COL_M1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-1학년(여)", column : "COL_W1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-2학년(남)", column : "COL_M2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-2학년(여)", column : "COL_W2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-3학년(남)", column : "COL_M3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-3학년(여)", column : "COL_W3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-4학년(남)", column : "COL_M4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-4학년(여)", column : "COL_W4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-5학년(남)", column : "COL_M5", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-5학년(여)", column : "COL_W5", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-6학년(남)", column : "COL_M6", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-6학년(여)", column : "COL_W6", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-특수(남)", column : "COL_M7", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-특수(여)", column : "COL_W7", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-순회(남)", column : "COL_M8", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-순회(여)", column : "COL_W8", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-계(남)", column : "COL_MSUM1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-계(여)", column : "COL_WSUM1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년(남)", column : "COL_M9", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년(여)", column : "COL_W9", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년(남)", column : "COL_M10", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년(여)", column : "COL_W10", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년(남)", column : "COL_M11", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년(여)", column : "COL_W11", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-특수(남)", column : "COL_M12", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-특수(여)", column : "COL_W12", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회(남)", column : "COL_M13", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회(여)", column : "COL_W13", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-계(남)", column : "COL_MSUM2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-계(여)", column : "COL_WSUM2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년(남)", column : "COL_M14", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년(여)", column : "COL_W14", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년(남)", column : "COL_M15", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년(여)", column : "COL_W15", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년(남)", column : "COL_M16", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년(여)", column : "COL_W16", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-특수(남)", column : "COL_M17", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-특수(여)", column : "COL_W17", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회(남)", column : "COL_M18", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회(여)", column : "COL_W18", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-계(남)", column : "COL_MSUM3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-계(여)", column : "COL_WSUM3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "총계(남)", column : "COL_MSUM4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "총계(여)", column : "COL_WSUM4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "합계", column : "COL_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "명";
			
			break;
			
		case "09"://09	학년별·학급별 학생수
			var columns = [{ label : "1학년 학급수", column : "COL_C1", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "1학년 학생수", column : "COL_S1", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "1학년 학급당 학생수", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "2학년 학급수", column : "COL_C2", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "2학년 학생수", column : "COL_S2", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "2학년 학급당 학생수", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "3학년 학급수", column : "COL_C3", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "3학년 학생수", column : "COL_S3", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "3학년 학급당 학생수", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "4학년 학급수", column : "COL_C4", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "4학년 학생수", column : "COL_S4", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "4학년 학급당 학생수", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "5학년 학급수", column : "COL_C5", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "5학년 학생수", column : "COL_S5", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "5학년 학급당 학생수", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "6학년 학급수", column : "COL_C6", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "6학년 학생수", column : "COL_S6", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "6학년 학급당 학생수", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "02,06", startDate : "", endDate : "", kind : "" }
						, { label : "특수학급 학급수", column : "COL_C7", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "특수학급 학생수", column : "COL_S7", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "특수학급 학급당 학생수", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "순회학급 학급수", column : "COL_C8", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "순회학급 학생수", column : "COL_S8", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "순회학급 학급당 학생수", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "학급수(계)", column : "COL_C_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "학생수(계)", column : "COL_S_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "학급당 학생수(계)", column : "COL_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "교사수", column : "TEACH_CNT", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "수업교원 1인당 학생수", column : "TEACH_CAL", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,06", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유 학급수", column : "COL_C1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유 학생수", column : "COL_S1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유 학급당 학생수", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유-순회 학급수", column : "COL_C15", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유-순회 학생수", column : "COL_S15", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-유-순회 학급당 학생수", column : "COL_15", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-1학년 학급수", column : "COL_C2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-1학년 학생수", column : "COL_S2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-1학년 학급당 학생수", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-2학년 학급수", column : "COL_C3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-2학년 학생수", column : "COL_S3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-2학년 학급당 학생수", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-3학년 학급수", column : "COL_C4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-3학년 학생수", column : "COL_S4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-3학년 학급당 학생수", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-4학년 학급수", column : "COL_C5", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-4학년 학생수", column : "COL_S5", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-4학년 학급당 학생수", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-5학년 학급수", column : "COL_C6", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-5학년 학생수", column : "COL_S6", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-5학년 학급당 학생수", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-6학년 학급수", column : "COL_C7", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-6학년 학생수", column : "COL_S7", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-6학년 학급당 학생수", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-초-순회 학급수", column : "COL_C16", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-초-순회 학생수", column : "COL_S16", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부-초-순회 학급당 학생수", column : "COL_16", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부 학급수(계)", column : "COL_SUM_C1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부 학생수(계)", column : "COL_SUM_S1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "유초등부 학급당 학생수(계)", column : "COL_SUM_1", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년 학급수", column : "COL_C8", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년 학생수", column : "COL_S8", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년 학급당 학생수", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년 학급수", column : "COL_C9", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년 학생수", column : "COL_S9", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년 학급당 학생수", column : "COL_9", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년 학급수", column : "COL_C10", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년 학생수", column : "COL_S10", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년 학급당 학생수", column : "COL_10", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회 학급수", column : "COL_C17", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회 학생수", column : "COL_S17", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회 학급당 학생수", column : "COL_17", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부 학급수(계)", column : "COL_SUM_C2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부 학생수(계)", column : "COL_SUM_S2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부 학급당 학생수(계)", column : "COL_SUM_2", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년 학급수", column : "COL_C11", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년 학생수", column : "COL_S11", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년 학급당 학생수", column : "COL_11", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년 학급수", column : "COL_C12", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년 학생수", column : "COL_S12", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년 학급당 학생수", column : "COL_12", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년 학급수", column : "COL_C13", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년 학생수", column : "COL_S13", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년 학급당 학생수", column : "COL_13", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회 학급수", column : "COL_C18", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회 학생수", column : "COL_S18", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회 학급당 학생수", column : "COL_18", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부 학급수(계)", column : "COL_SUM_C3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부 학생수(계)", column : "COL_SUM_S3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부 학급당 학생수(계)", column : "COL_SUM_3", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "전공과 학급수", column : "COL_C14", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "전공과 학생수", column : "COL_S14", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "전공과 학급당 학생수", column : "COL_14", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "총계 학급수", column : "COL_C_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "총계 학생수", column : "COL_S_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "총계 학급당 학생수", column : "COL_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "교사수", column : "TEACH_CNT", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "수업교원 1인당 학생수", column : "TEACH_CAL", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-1학년 학급수", column : "COL_C1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-1학년 학생수", column : "COL_S1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-1학년 학급당 학생수", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-2학년 학급수", column : "COL_C2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-2학년 학생수", column : "COL_S2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-2학년 학급당 학생수", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-3학년 학급수", column : "COL_C3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-3학년 학생수", column : "COL_S3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-3학년 학급당 학생수", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-4학년 학급수", column : "COL_C4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-4학년 학생수", column : "COL_S4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-4학년 학급당 학생수", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-5학년 학급수", column : "COL_C5", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-5학년 학생수", column : "COL_S5", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-5학년 학급당 학생수", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-6학년 학급수", column : "COL_C6", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-6학년 학생수", column : "COL_S6", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-6학년 학급당 학생수", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-특수 학급수", column : "COL_C7", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-특수 학생수", column : "COL_S7", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-특수 학급당 학생수", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-순회 학급수", column : "COL_C8", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-순회 학생수", column : "COL_S8", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부-순회 학급당 학생수", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부 학급수(계)", column : "COL_SUM_C1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부 학생수(계)", column : "COL_SUM_S1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "초등부 학급당 학생수(계)", column : "COL_SUM_1", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년 학급수", column : "COL_C9", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년 학생수", column : "COL_S9", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-1학년 학급당 학생수", column : "COL_9", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년 학급수", column : "COL_C10", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년 학생수", column : "COL_S10", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-2학년 학급당 학생수", column : "COL_10", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년 학급수", column : "COL_C11", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년 학생수", column : "COL_S11", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-3학년 학급당 학생수", column : "COL_11", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-특수 학급수", column : "COL_C12", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-특수 학생수", column : "COL_S12", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-특수 학급당 학생수", column : "COL_12", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회 학급수", column : "COL_C13", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회 학생수", column : "COL_S13", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부-순회 학급당 학생수", column : "COL_13", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부 학급수(계)", column : "COL_SUM_C2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부 학생수(계)", column : "COL_SUM_S2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "중등부 학급당 학생수(계)", column : "COL_SUM_2", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년 학급수", column : "COL_C14", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년 학생수", column : "COL_S14", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-1학년 학급당 학생수", column : "COL_14", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년 학급수", column : "COL_C15", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년 학생수", column : "COL_S15", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-2학년 학급당 학생수", column : "COL_15", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년 학급수", column : "COL_C16", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년 학생수", column : "COL_S16", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-3학년 학급당 학생수", column : "COL_16", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-특수 학급수", column : "COL_C17", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-특수 학생수", column : "COL_S17", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-특수 학급당 학생수", column : "COL_17", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회 학급수", column : "COL_C18", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회 학생수", column : "COL_S18", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부-순회 학급당 학생수", column : "COL_18", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부 학급수(계)", column : "COL_SUM_C3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부 학생수(계)", column : "COL_SUM_S3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "고등부 학급당 학생수(계)", column : "COL_SUM_3", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "총계 학급수", column : "COL_SUM_C4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "총계 학생수", column : "COL_SUM_S4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "총계 학급당 학생수", column : "COL_SUM_4", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "교사수", column : "TEACH_CNT", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }
						, { label : "수업교원 1인당 학생수", column : "TEACH_CAL", index : 0, rowspan : "", colspan : "", schulKndCode : "07", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "학급수 - 개, 학생수/교사수 - 명";
			
			break;
			
		case "10"://10	전·출입 및 학업중단 학생 수
			var columns = [{ label : "1학년 전입학생수", column : "COL_211", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "1학년 전출학생수", column : "COL_212", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "1학년 전체학생수", column : "STDNT_SUM_21", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "2학년 전입학생수", column : "COL_221", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "2학년 전출학생수", column : "COL_222", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "2학년 전체학생수", column : "STDNT_SUM_22", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "3학년 전입학생수", column : "COL_231", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "3학년 전출학생수", column : "COL_232", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "3학년 전체학생수", column : "STDNT_SUM_23", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "4학년 전입학생수", column : "COL_241", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "4학년 전출학생수", column : "COL_242", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "4학년 전체학생수", column : "STDNT_SUM_24", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "5학년 전입학생수", column : "COL_251", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "5학년 전출학생수", column : "COL_252", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "5학년 전체학생수", column : "STDNT_SUM_25", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "6학년 전입학생수", column : "COL_261", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "6학년 전출학생수", column : "COL_262", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "6학년 전체 학생수", column : "STDNT_SUM_26", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "초등부1학년 전입학생수", column : "COL_211", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부1학년 전출학생수", column : "COL_212", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부1학년 전체학생수", column : "STDNT_SUM_21", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부2학년 전ㅏ수", column : "COL_221", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부2학년 전출학생수", column : "COL_222", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부2학년 전체학생수", column : "STDNT_SUM_22", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부3학년 전입학생수", column : "COL_231", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부3학년 전출학생수", column : "COL_232", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부3학년 전체학생수", column : "STDNT_SUM_23", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부4학년 전입학생수", column : "COL_241", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부4학년 전출학생수", column : "COL_242", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부4학년 전체학생수", column : "STDNT_SUM_24", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부5학년 전입학생수", column : "COL_251", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부5학년 전출학생수", column : "COL_252", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부5학년 전체학생수", column : "STDNT_SUM_25", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부6학년 전입학생수", column : "COL_261", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부6학년 전출학생수", column : "COL_262", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "초등부6학년 전체학생수", column : "STDNT_SUM_26", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부1학년 전입학생수", column : "COL_311", index : 0, rowspan : "", colspan : "", schulKndCode : "03,05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부1학년 전출학생수", column : "COL_312", index : 0, rowspan : "", colspan : "", schulKndCode : "03,05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부1학년 전체학생수", column : "STDNT_SUM_31", index : 0, rowspan : "", colspan : "", schulKndCode : "03,05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부2학년 전입학생수", column : "COL_321", index : 0, rowspan : "", colspan : "", schulKndCode : "03,05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부2학년 전출학생수", column : "COL_322", index : 0, rowspan : "", colspan : "", schulKndCode : "03,05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부2학년 전체학생수", column : "STDNT_SUM_32", index : 0, rowspan : "", colspan : "", schulKndCode : "03,05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부3학년 전입학생수", column : "COL_331", index : 0, rowspan : "", colspan : "", schulKndCode : "03,05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부3학년 전출학생수", column : "COL_332", index : 0, rowspan : "", colspan : "", schulKndCode : "03,05", startDate : "", endDate : "", kind : "" }
						, { label : "중등부3학년 전체학생수", column : "STDNT_SUM_33", index : 0, rowspan : "", colspan : "", schulKndCode : "03,05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부1학년 전입학생수", column : "COL_411", index : 0, rowspan : "", colspan : "", schulKndCode : "04,05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부1학년 전출학생수", column : "COL_412", index : 0, rowspan : "", colspan : "", schulKndCode : "04,05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부1학년 전체학생수", column : "STDNT_SUM_41", index : 0, rowspan : "", colspan : "", schulKndCode : "04,05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부2학년 전입학생수", column : "COL_421", index : 0, rowspan : "", colspan : "", schulKndCode : "04,05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부2학년 전출학생수", column : "COL_422", index : 0, rowspan : "", colspan : "", schulKndCode : "04,05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부2학년 전체학생수", column : "STDNT_SUM_42", index : 0, rowspan : "", colspan : "", schulKndCode : "04,05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부3학년 전입학생수", column : "COL_431", index : 0, rowspan : "", colspan : "", schulKndCode : "04,05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부3학년 전출학생수", column : "COL_432", index : 0, rowspan : "", colspan : "", schulKndCode : "04,05", startDate : "", endDate : "", kind : "" }
						, { label : "고등부3학년 전체학생수", column : "STDNT_SUM_43", index : 0, rowspan : "", colspan : "", schulKndCode : "04,05", startDate : "", endDate : "", kind : "" }
						, { label : "전입학생수(계)", column : "MVIN_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,05", startDate : "", endDate : "", kind : "" }
						, { label : "전출학생수(계)", column : "MVT_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,05", startDate : "", endDate : "", kind : "" }
						, { label : "전체학생수(계)", column : "STDNT_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02,03,04,05", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			baseSchulKnd["06"]["use"] = "N"; // 그외학교 사용 안함
			baseSchulKnd["07"]["use"] = "N"; // 각종학교 사용 안함
			unitText = "명";
			
			break;
			
		case "16"://16	학교용지 현황
			var columns = [{ label : "교사대지 및 기타", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2017", endDate : "2018", kind : "" }
						, { label : "교사대지", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2019", endDate : "9999", kind : "" }
						, { label : "체육장", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "계", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "부속토지", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "합 계", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "공동사용여부", column : "UNITY_UON", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "공동사용학교명", column : "UNITY_UON_SCHUL_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2019", endDate : "9999", kind : "" }
						, { label : "설립유형", column : "SCHUL_FOND_TYP_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "㎡";
			
			break;
			
		case "17"://17	교사(校舍) 현황
			var columns = [{ label : "교수학습공간", column : "", index : 0, rowspan : "", colspan : "5", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "일반교실", column : "COL_1", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교과교실", column : "CURR_CCCLA_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특별교실", column : "COL_5", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수준별교실", column : "COL_4", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기타", column : "COL_6", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						
						, { label : "학습지원공간", column : "", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "시청각실", column : "COL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "컴퓨터실", column : "COM_CCCLA_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "멀티미디어실", column : "MMA_CCCLA_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기타", column : "LRN_SPORT_ETC_CCCLA_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						
						, { label : "교원지원공간", column : "COL_7", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "관리행정공간", column : "COL_8", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "체육집회공간", column : "COL_9", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보건실", column : "COL_10", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학생탈의실", column : "COL_16", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학생샤워실", column : "STDNT_SWRM_FGR", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "남자화장실", column : "ML_TOI_FGR", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "여자화장실", column : "FML_TOI_FGR", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "공용화장실", column : "COMUS_TOI_FGR", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학생식당", column : "COL_12", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기숙사실수", column : "COL_13", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기타공간", column : "COL_14", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			var newBaseColumns = updateBaseColumns(baseColumns, "rowspan", "2"); // bascolumns의 rowspan 값을 2로 업데이트
			columns = $.merge( $.merge( [], newBaseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "실";
			
			break;
			
		case "18"://18	학생교육활동에 필요한 지원시설 현황
			var columns = [{ label : "체육관", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "강당", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기숙사 재실인원", column : "BRHS_RCPTN_NMPR_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수영장", column : "SWMPL_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "진로 상담실", column : "COSE_CNSRM_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "설립유형", column : "SCHUL_FOND_TYP_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "실";
			
			break;
		
		case "20"://20	학교시설 개방에 관한 사항
			var columns = [{ label : "체육장 개방여부", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "체육관 개방여부", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "강당 개방여부", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "일반교과교실 개방여부", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특별교실 개방여부", column : "COL_9", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "시청각실 개방여부", column : "COL_11", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			
			break;
			
		case "21"://21	장애인 편의시설 현황
			var columns = [{ label : "주 출입구 접근로 설치여부", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "장애인 전용 주차구역 지정여부", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "주 출입구 높이차이 제거여부", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "출입구(문) 설치유무", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "복도", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "계단/승강기/경사로/휠체어리프트 유무", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "장애인용 대변기 설치여부", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "장애인용 소변기 설치여부", column : "COL_9", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "점자블록 설치여부", column : "COL_10", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "유도 및 안내설비 설치여부", column : "COL_11", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "경보 및 피난설비 설치여부", column : "COL_12", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			
			break;
			
		case "22"://22	직위별 교원 현황
			var columns = [{ label : "교장(남)", column : "COL_M1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교장(여)", column : "COL_W1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교장(휴직교원)", column : "COL_R1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교장(계)", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교감(남)", column : "COL_M2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교감(여)", column : "COL_W2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교감(휴직교원)", column : "COL_R2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교감(계)", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수석교사(남)", column : "COL_M15", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수석교사(여)", column : "COL_W15", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수석교사(휴직교원)", column : "COL_R15", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수석교사(계)", column : "COL_15", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보직교사(남)", column : "COL_M3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보직교사(여)", column : "COL_W3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보직교사(휴직교원)", column : "COL_R3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보직교사(계)", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "일반교사(남)", column : "COL_M4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "일반교사(여)", column : "COL_W4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "일반교사(휴직교원)", column : "COL_R4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "일반교사(계)", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수교사(남)", column : "COL_M5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수교사(여)", column : "COL_W5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수교사(휴직교원)", column : "COL_R5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수교사(계)", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전문상담교사(남)", column : "COL_M6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전문상담교사(여)", column : "COL_W6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전문상담교사(휴직교원)", column : "COL_R6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전문상담교사(계)", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "사서교사(남)", column : "COL_M7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "사서교사(여)", column : "COL_W7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "사서교사(휴직교원)", column : "COL_R7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "사서교사(계)", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "실기교사(남)", column : "COL_M8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "실기교사(여)", column : "COL_W8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "실기교사(휴직교원)", column : "COL_R8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "실기교사(계)", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보건교사(남)", column : "COL_M9", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보건교사(여)", column : "COL_W9", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보건교사(휴직교원)", column : "COL_R9", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보건교사(계)", column : "COL_9", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "영양교사(남)", column : "COL_M10", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "영양교사(여)", column : "COL_W10", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "영양교사(휴직교원)", column : "COL_R10", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "영양교사(계)", column : "COL_10", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기간제교사(남)", column : "COL_M11", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기간제교사(여)", column : "COL_W11", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기간제교사(휴직교원)", column : "COL_R11", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기간제교사(계)", column : "COL_11", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "강사(남)", column : "COL_M13", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "강사(여)", column : "COL_W13", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "강사(휴직교원)", column : "COL_R13", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "강사(계)", column : "COL_13", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "총계(남)", column : "COL_SM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "총계(여)", column : "COL_SW", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "총계(휴직교원)", column : "COL_SR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "총계(계)", column : "COL_S", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "원어민강사(남)", column : "COL_M14", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "원어민강사(여)", column : "COL_W14", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "원어민강사(계)", column : "COL_14", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "휴직교원수", column : "COL_R_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "명";
			
			break;
			
		case "64"://64	자격종별 교원 현황
			var columns = [{ label : "교장(남)", column : "COL_M1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교장(여)", column : "COL_W1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교장(계)", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교감(남)", column : "COL_M2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교감(여)", column : "COL_W2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교감(계)", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수석교사(남)", column : "COL_M21", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수석교사(여)", column : "COL_W21", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수석교사(계)", column : "COL_21", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "정교사(1정)(남)", column : "COL_M3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "정교사(1정)(여)", column : "COL_W3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "정교사(1정)(계)", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "정교사(2정)(남)", column : "COL_M4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "정교사(2정)(여)", column : "COL_W4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "정교사(2정)(계)", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수1정(남)", column : "COL_M19", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수1정(여)", column : "COL_W19", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수1정(계)", column : "COL_19", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수2정(남)", column : "COL_M20", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수2정(여)", column : "COL_W20", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수2정(계)", column : "COL_20", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "준교사(남)", column : "COL_M5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "준교사(여)", column : "COL_W5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "준교사(계)", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "실기교사(남)", column : "COL_M8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "실기교사(여)", column : "COL_W8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "실기교사(계)", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전문상담교사(남)", column : "COL_M6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전문상담교사(여)", column : "COL_W6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전문상담교사(계)", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "사서교사(남)", column : "COL_M7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "사서교사(여)", column : "COL_W7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "사서교사(계)", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보건교사(남)", column : "COL_M9", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보건교사(여)", column : "COL_W9", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보건교사(계)", column : "COL_9", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "영양교사(남)", column : "COL_M10", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "영양교사(여)", column : "COL_W10", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "영양교사(계)", column : "COL_10", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "해당없음(남)", column : "COL_M11", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "해당없음(여)", column : "COL_W11", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "해당없음(계)", column : "COL_11", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "계(남)", column : "COL_SM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "계(여)", column : "COL_SW", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "계", column : "COL_S", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "명";
			
			break;
			
		case "24"://24 표시과목별 교원 현황
			var depth01 = [{ label : "교감(남)", column : "COL1_M1", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "교감(여)", column : "COL1_W1", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "교감(계)", column : "COL1_1", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }

			, { label : "단식(남)", column : "COL1_M2", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "0", endDate : "2020", kind : ""  }
			, { label : "단식(여)", column : "COL1_W2", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "0", endDate : "2020", kind : ""  }
			, { label : "단식(계)", column : "COL1_2", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "0", endDate : "2020", kind : ""  }
			, { label : "복식(남)", column : "COL1_M3", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "0", endDate : "2020", kind : ""  }
			, { label : "복식(여)", column : "COL1_W3", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "0", endDate : "2020", kind : ""  }
			, { label : "복식(계)", column : "COL1_3", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "0", endDate : "2020", kind : ""  }
			
			, { label : "일반학급(남)", column : "COL1_M2", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "2021", endDate : "9999", kind : ""  }
			, { label : "일반학급(여)", column : "COL1_W2", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "2021", endDate : "9999", kind : ""  }
			, { label : "일반학급(계)", column : "COL1_2", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "2021", endDate : "9999", kind : ""  }
			, { label : "특수학급(남)", column : "COL1_M3", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "2021", endDate : "9999", kind : ""  }
			, { label : "특수학급(여)", column : "COL1_W3", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "2021", endDate : "9999", kind : ""  }
			, { label : "특수학급(계)", column : "COL1_3", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "2021", endDate : "9999", kind : ""  }
			, { label : "순회학급(남)", column : "COL1_M4", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "2021", endDate : "9999", kind : ""  }
			, { label : "순회학급(여)", column : "COL1_W4", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "2021", endDate : "9999", kind : ""  }
			, { label : "순회학급(계)", column : "COL1_4", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "2021", endDate : "9999", kind : ""  }
			
			, { label : "국어(남)", column : "COL_M1", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "국어(여)", column : "COL_W1", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "국어(계)", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "도덕(남)", column : "COL_M2", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "도덕(여)", column : "COL_W2", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "도덕(계)", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "사회(남)", column : "COL_M3", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "사회(여)", column : "COL_W3", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "사회(계)", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "수학(남)", column : "COL_M4", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "수학(여)", column : "COL_W4", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "수학(계)", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "과학(남)", column : "COL_M5", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "과학(여)", column : "COL_W5", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "과학(계)", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "실과(남)", column : "COL_M6", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "실과(여)", column : "COL_W6", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "실과(계)", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "체육(남)", column : "COL_M7", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "체육(여)", column : "COL_W7", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "체육(계)", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "음악(남)", column : "COL_M8", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "음악(여)", column : "COL_W8", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "음악(계)", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "미술(남)", column : "COL_M9", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "미술(여)", column : "COL_W9", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "미술(계)", column : "COL_9", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "외국어(영어)(남)", column : "COL_M10", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "외국어(영어)(여)", column : "COL_W10", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "외국어(영어)(계)", column : "COL_10", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "컴퓨터(남)", column : "COL_M11", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "컴퓨터(여)", column : "COL_W11", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "컴퓨터(계)", column : "COL_11", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "재량활동(남)", column : "COL_M12", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "재량활동(여)", column : "COL_W12", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "재량활동(계)", column : "COL_12", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "통합교과(남)", column : "COL_M13", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "통합교과(여)", column : "COL_W13", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "통합교과(계)", column : "COL_13", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "기타(남)", column : "COL_M14", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "기타(여)", column : "COL_W14", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "기타(계)", column : "COL_14", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
			, { label : "교과코드", column : "FMTCD", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "교과차수", column : "PJ_CHASU", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "상위교과", column : "UPPER_ORGA_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "교과명", column : "ORGA_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "교원수(남)", column : "ML_TCHER_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "교원수(여)", column : "FML_TCHER_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "교원수(계)", column : "SUM_CNT", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }];
			
			var depth02 = [{ label : "교과코드", column : "FMTCD", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "교과차수", column : "PJ_CHASU", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "상위교과", column : "UPPER_ORGA_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "과목코드", column : "SBJT_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "과목명", column : "SBJT_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "교원수(남)", column : "ML_TCHER_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "교원수(여)", column : "FML_TCHER_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
			, { label : "교원수(계)", column : "SUM_CNT", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }];

			var depth01 = $.merge( $.merge( [], baseColumns ), depth01);
			var depth02 = $.merge( $.merge( [], baseColumns ), depth02);
			
			tableHeadInfo = [ { depth : "10", columns : depth01 }, { depth : "20", columns : depth02 } ];
			
			baseSchulKnd["05"]["use"] = "N"; // 특수학교 사용 안함
			baseSchulKnd["06"]["use"] = "N"; // 그외학교 사용 안함
			baseSchulKnd["07"]["use"] = "N"; // 각종학교 사용 안함
			unitText = {"10" : "명", "20" : "명" };
			
			break;
		
		case "27"://27	학교회계 예·결산서
			// kind : 01(예산-세입),02(예산-세출),03(결산-세입),04(결산-세출)
			var columns = [{ label : "예결산구분", column : "FAS_DTN_SC_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "세입세출구분", column : "PBAN_REV_EX_SC_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "정부이전수입", column : "AMT1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "기타이전수입", column : "AMT2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "학부모부담수입", column : "AMT3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "지원금수입", column : "AMT4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "행정활동수입", column : "AMT5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "기타", column : "AMT6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "예결산구분", column : "FAS_DTN_SC_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "세입세출구분", column : "PBAN_REV_EX_SC_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "인적자원운용", column : "AMT1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "학생복지/교육격차해소", column : "AMT2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "기본적교육활동", column : "AMT3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "선택적교육활동", column : "AMT4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "교육활동지원", column : "AMT5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "학교일반운영", column : "AMT6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "학교시설확충", column : "AMT7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "학교재무활동", column : "AMT8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "10", columns : columns }, { depth : "20", columns : columns } ]; // depth 예산10, 결산20 헤더 같음
			unitText = {"10" : "원", "20" : "원" };
			
			break;
			
		case "28"://28	사립학교 교비회계 예·결산서
			var columns = [{ label : "예결산구분", column : "FAS_DTN_SC_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "세입세출구분", column : "PBAN_REV_EX_SC_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "정부이전수입", column : "AMT1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "기타이전수입", column : "AMT2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "학부모부담수입", column : "AMT3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "지원금수입", column : "AMT4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "행정활동수입", column : "AMT5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "기타", column : "AMT6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "01,03" }
						, { label : "예결산구분", column : "FAS_DTN_SC_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "세입세출구분", column : "PBAN_REV_EX_SC_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "인적자원운용", column : "AMT1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "학생복지/교육격차해소", column : "AMT2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "기본적교육활동", column : "AMT3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "선택적교육활동", column : "AMT4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "교육활동지원", column : "AMT5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "학교일반운영", column : "AMT6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "학교시설확충", column : "AMT7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }
						, { label : "학교재무활동", column : "AMT8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "02,04" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "10", columns : columns }, { depth : "20", columns : columns } ]; // depth 예산10, 결산20 헤더 같음
			unitText = {"10" : "원", "20" : "원" }
			
			break;
		
		case "30"://30	학교발전기금
			var columns = [{ label : "금전및 유가증권건수", column : "MONE_AWA_SCRTS_CNT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "금전및 유가증권금액", column : "MONE_AWA_SCRTS_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "도서및 물품건수", column : "BOS_AWA_THNG_CNT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "도서및 물품금액", column : "BOS_AWA_THNG_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수목시설및 재산건수", column : "FA_AWA_FRTUN_CNT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수목시설및 재산금액", column : "FA_AWA_FRTUN_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "건수합계", column : "CNT_SMTOT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "금액합계", column : "AMT_SMTOT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학교교육시설 보수확충금액", column : "SCHUL_EDC_FA_PAY_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교육용기자재 및도서금액", column : "EDCL_MHRML_AWA_BOS_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학교체육학예 활동금액", column : "SCHUL_PHE_ACT_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학생복지및 자치활동지원금액", column : "WELF_ATMY_ACT_SPORT_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "지출금액합계", column : "EXPNT_AMT_SMTOT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "건수 - 건, 금액 - 원";
			
			break;
			
		case "34"://34	급식실시 현황
			var columns = [{ label : "운영방식 - 급식종류", column : "OPER_MET_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "운영방식 - 직영급식", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "운영방식 - 전부위탁(업체명)", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "운영방식 - 일부위탁(업체명)", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전체학생수", column : "HAKSAENGSU_TOT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "급식학생수", column : "MLSV_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "급식비율", column : "KS_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "급식담당인력(명) - 영양(교)사", column : "NTRST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "급식담당인력(명) - 조리사", column : "COOK_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "급식담당인력(명) - 조리원", column : "COOAS_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "배식장소 - 배식장소(식당)", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "배식장소 - 배식장소(교실)", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "배식장소 - 배식장소(식당+교실)", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "배식장소 - 배식장소(기타)", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "학생수 - 명, 비율 - %";
			
			break;
			
		case "35"://35	급식비 집행 실적
			var depth01 = [{ label : "교육청금액", column : "OFCDC_SUF", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교육청비율", column : "OFCDC_SUF_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "자치단체금액", column : "SFRND_SUF", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "자치단체비율", column : "SFRND_SUF_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						//, { label : "학교금액(2018년까지)", column : "SCHUL_ONSLF_SUF", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						//, { label : "학교비율(2018년까지)", column : "SCHUL_ONSLF_SUF_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보호자금액", column : "GU_SUF", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "보호자비율", column : "GU_SUF_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기타금액", column : "ETC_SPRT_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "기타비율", column : "ETC_OFCDC_SUF_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "금액계", column : "TOTAL_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "비율계", column : "TOTAL_AMT_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			var label = "";
			if(pbanYr >= "2023") {
				label = "학생 1인당 1식 기준 식품비";
			} else {
				label = "학생 1인당 급식비 (1식 기준)";
			}	
			
			var depth02 = [{ label : label, column : "STDNT_ONE_PSNBY_LM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			var depth01 = $.merge( $.merge( [], baseColumns ), depth01);
			var depth02 = $.merge( $.merge( [], baseColumns ), depth02);
			
			tableHeadInfo = [ { depth : "10", columns : depth01 }, { depth : "20", columns : depth02 } ];
			unitText = { "10" : "금액 - 원, 비율 : %" 
			          ,  "20" : "금액 - 원" };

			break;
			
		case "51"://51	입학생 현황
			var columns = [{ label : "적령 아동-남", column : "BEAGE_BOY_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "적령 아동-여", column : "BEAGE_GIR_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "적령 아동-합계", column : "SUBEAGE_BOY_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "적령 아동-비율", column : "SUBEAGE_BOY_FGR_R", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "유예 및 과령 아동-남", column : "HEST_AWA_LTAGE_BOY_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "유예 및 과령 아동-여", column : "HEST_AWA_LTAGE_GIR_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "유예 및 과령 아동-합계", column : "SUHEST_AWA_LTAGE_BOY_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "유예 및 과령 아동-비율", column : "SUHEST_AWA_LTAGE_BOY_FGR_R", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "조기입학아동-남", column : "ELPD_ETRC_BOY_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "조기입학아동-여", column : "ELPD_ETRC_GIR_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "조기입학아동-합계", column : "SUELPD_ETRC_BOY_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "조기입학아동-비율", column : "SUELPD_ETRC_BOY_FGR_R", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "계-남", column : "TOTAL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "계-여", column : "TOTAL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "합계", column : "TOT_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "02", startDate : "", endDate : "", kind : "" }
						, { label : "당해연도 졸업자-남", column : "PRTI_GRDTN_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "당해연도 졸업자-여", column : "PRTI_GRDTN_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "당해연도 졸업자-합계", column : "SUPRTI_GRDTN_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "당해연도 졸업자-비율", column : "YEAR_GRAD_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "이전연도 졸업자-남", column : "BFR_YR_GRDTN_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "이전연도 졸업자-여", column : "BFR_YR_GRDTN_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "이전연도 졸업자-합계", column : "SUBFR_YR_GRDTN_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "이전연도 졸업자-비율", column : "LAST_YEAR_GRAD_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "검정고시 및 교육과정 이수자-남", column : "SQE_COMPT_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "검정고시 및 교육과정 이수자-여", column : "SQE_COMPT_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "검정고시 및 교육과정 이수자-합계", column : "SUSQE_COMPT_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "검정고시 및 교육과정 이수자-비율", column : "TGMG_QT_QULF_TEST_ST_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "외국학교수학자-남", column : "FRNTN_SCHUL_MTHMC_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : "" }
						, { label : "외국학교수학자-여", column : "FRNTN_SCHUL_MTHMC_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : "" }
						, { label : "외국학교수학자-합계", column : "SUFRNTN_SCHUL_MTHMC_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : "" }
						, { label : "외국학교수학자-비율", column : "FOREIGN_ST_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : "" }
						
						, { label : "기 타-남", column : "ETC_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "기 타-여", column : "ETC_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "기 타-합계", column : "SUETC_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "기 타-비율", column : "ETC_ST_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "소계-남", column : "MAN_TOT", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "소계-여", column : "WOMAN_TOT", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "소계-합계(A)", column : "TOTAL_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "소계-비율", column : "TOTAL_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "정원외 입학자-남", column : "TOFOR_EXCL_ETRC_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "정원외 입학자-여", column : "TOFOR_EXCL_ETRC_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "정원외 입학자-합계", column : "SUTOFOR_EXCL_ETRC_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "정원외 입학자-비율", column : "STRENGTH_UP_ST_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "재입·편입학자-남", column : "ENTRY_RETRC_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "재입·편입학자-여", column : "ENTRY_RETRC_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "재입·편입학자-합계", column : "SUENTRY_RETRC_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "재입·편입학자-비율", column : "READMISSION_ST_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "소계-남", column : "MAN1_TOT", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "소계-여", column : "WOMAN1_TOT", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "소계-합계(B)", column : "TOTAL1_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "소계-비율", column : "TOTAL1_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "0", endDate : "2020", kind : ""  }
						, { label : "합계-남", column : "MAN_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "합계-여", column : "WOMAN_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "합계", column : "ALL_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "03,04", startDate : "", endDate : "", kind : "" }
						, { label : "시각장애-남", column : "HDEY_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "시각장애-여", column : "HDEY_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "시각장애-합계", column : "SUHDEY_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "시각장애-비율", column : "VISUALLY_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "청각장애-남", column : "HDER_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "청각장애-여", column : "HDER_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "청각장애-합계", column : "SUHDER_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "청각장애-비율", column : "HEARING_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "정신지체-남", column : "MER_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "정신지체-여", column : "MER_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "정신지체-합계", column : "SUMER_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "정신지체-비율", column : "PSYCHO_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "지체장애-남", column : "HDCPD_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "지체장애-여", column : "HDCPD_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "지체장애-합계", column : "SUHDCPD_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "지체장애-비율", column : "INVALID1_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "정서·행동장애-남", column : "EMD_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "정서·행동장애-여", column : "EMD_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "정서·행동장애-합계", column : "SUEMD_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "정서·행동장애-비율", column : "DISTURBED_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "자폐성장애-남", column : "AUTIS_TROBL_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "자폐성장애-여", column : "AUTIS_TROBL_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "자폐성장애-합계", column : "SUAUTIS_TROBL_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "자폐성장애-비율", column : "AUTIS_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "의사소통장애-남", column : "LANG_TROBL_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "의사소통장애-여", column : "LANG_TROBL_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "의사소통장애-합계", column : "SULANG_TROBL_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "의사소통장애-비율", column : "IMPEDIMENT_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "학습장애-남", column : "HDST_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "학습장애-여", column : "HDST_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "학습장애-합계", column : "SUHDST_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "학습장애-비율", column : "HDST_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "건강장애-남", column : "HLTH_TROBL_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "건강장애-여", column : "HLTH_TROBL_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "건강장애-합계", column : "SUHLTH_TROBL_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "건강장애-비율", column : "HLTH_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "발달지체-남", column : "DEV_TROBL_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "발달지체-여", column : "DEV_TROBL_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "발달지체-합계", column : "SUDEV_TROBL_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "발달지체-비율", column : "DEV_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "기타-남", column : "ETC_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "기타-여", column : "ETC_FES_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "기타-합계", column : "SUETC_BOYST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "기타-비율", column : "ETC_STD_RATE", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "합계-남", column : "SUM_MAN", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "합계-여", column : "SUM_WOMAN", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }
						, { label : "합계", column : "TOTAL_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "05", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			baseSchulKnd["06"]["use"] = "N"; // 그외학교 사용 안함
			baseSchulKnd["07"]["use"] = "N"; // 각종학교 사용 안함
			unitText = "명, 비율 - %";
			
			break;
			
		case "52"://52	졸업생의 진로 현황
//			var columns = [];
//			
//			columns = $.merge( $.merge( [], baseColumns ), columns );
//			tableHeadInfo = [ { depth : "0", columns : columns } ];
//			baseSchulKnd["06"]["use"] = "N"; // 그외학교 사용 안함
			
			break;
			
		case "55"://55	장학금 수혜 현황
			var columns = [{ label : "장학금인원", column : "SCHO_NMPR_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "장학금금액", column : "SCHO_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학비지원인원", column : "SCE_RDCTN_NMPR_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학비지원금액", column : "SCE_RDCTN_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "인원합계", column : "NMPR_FGR_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "금액합계", column : "AMT_SUM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "인원 - 명, 금액 - 원";
			
			break;
			
		case "56"://56	동아리 활동 현황
			var columns = [ { label : "창의적체험활동동아리", column : "", index : 0, rowspan : "", colspan : "5", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "동아리수", column : "CREAT_EXPER_ACT_CCCLU_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "참여학생수", column : "CREAT_EXPER_ACT_STDNT_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "지도교사수", column : "CREAT_EXPER_ACT_CCH_TCR_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "자원봉사 또는외부강사수", column : "CREAT_EXPER_ACT_EXTRLLECTR_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "동아리활동 예산지원현황", column : "CREAT_EXPER_ACT_BDG_SPORT_AMT", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "학생자율동아리", column : "", index : 0, rowspan : "", colspan : "5", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "동아리수", column : "STDNT_SLCTL_CCCLU_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "참여학생수", column : "STDNT_SLCTL_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "지도교사수", column : "CCH_TCR_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "자원봉사 또는외부강사수", column : "VOL_AWA_EXTRL_LECTR_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "동아리활동 예산지원현황", column : "CCCLU_ACT_BDG_SPORT_AMT", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			var newBaseColumns = updateBaseColumns(baseColumns, "rowspan", "2"); // bascolumns의 rowspan 값을 2로 업데이트
			columns = $.merge( $.merge( [], newBaseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			baseSchulKnd["05"]["use"] = "N"; // 특수학교 사용 안함
			unitText = "동아리수 - 개, 학생수/교사수/강사수 - 명, 동아리활동예산지원현황 - 원";
			
			break;
			
		case "58"://58	학교도서관 현황
			var depth01 = [{ label : "도서자료", column : "GNRL_BOKS_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "비도서자료수", column : "NN_BOS_DTA_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "합계", column : "SUMCNT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전체학생수", column : "PBAN_YR_ALL_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "1인당장서수", column : "RATIO", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			var depth02 = [{ label : "도서관수", column : "LBRRY_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "도서관(실)총좌석수", column : "BKRUM_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "사서자격증보유", column : "LBRRY_CRQFC_RET_STAFF_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "사서자격증미보유", column : "LBRRY_CRQFC_UN_RET_STAFF_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "자료구입비예산액", column : "PRTI_DTA_PHS_CST", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "운영비예산액", column : "PRTI_LBRRY_OPER_CST", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			var depth03 = [{ label : "연간학생대출자료수", column : "LBRRY_LN_DTA_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전년도전체학생수", column : "LYR_ALL_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "연간학생대출자수", column : "LBRRY_LEND_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "1인당대출자료수", column : "DATA1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			var depth01 = $.merge( $.merge( [], baseColumns ), depth01);
			var depth02 = $.merge( $.merge( [], baseColumns ), depth02);
			var depth03 = $.merge( $.merge( [], baseColumns ), depth03);
			
			tableHeadInfo = [ { depth : "10", columns : depth01 }, { depth : "20", columns : depth02 }, { depth : "30", columns : depth03 } ];
			unitText = { "10" : "도서자료 - 권, 비도서자료/합계/1인당장서수 - 개, 학생수 - 명"
			          ,  "20" : "도서관수/도서관(실)총좌석수 - 개, 사서자격증보유/사서자격증미보유 - 명, 예산액 - 원"
			          ,  "30" : "연간학생대출자료수/1인당대출자료수 - 권, 학생수 - 명" };
			

			break;
			
		case "59"://59	방과후학교 운영 계획 및 운영ㆍ지원현황
			var columns = [{ label : "교과프로그램수", column : "ASL_CURR_PGM_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "교과수강학생수", column : "ASL_CURR_REG_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특기적성프로그램수", column : "ASL_SPABL_APTD_PGM_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특기적성수강학생수", column : "ASL_SPABL_APTD_REG_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "프로그램수(계)", column : "SUM_ASL_PGM_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "수강학생수(계)", column : "SUM_ASL_REG_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "방과후학교참여학생수", column : "ASL_PTPT_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "초등돌봄교실 오후돌봄운영교실수", column : "ECC_PM_OPER_CCCLA_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "초등돌봄교실 오후돌봄참여학생수", column : "ECC_PM_PTPT_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "초등돌봄교실 저녁돌봄운영교실수", column : "ECC_DINNR_OPER_CCCLA_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "초등돌봄교실 저녁돌봄참여학생수", column : "ECC_DINNR_PTPT_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "초등돌봄교실방과후학교 연계형돌봄운영교실수", column : "ASL_LINK_ECC_OPER_CCCLA_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "초등돌봄교실방과후학교 연계형돌봄참여학생수", column : "ASL_LINK_ECC_PTPT_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "초등돌봄참여학생중 특수교육대상학생수", column : "SPCLY_CCCCL_PTPT_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2021", endDate : "9999", kind : "" }
						, { label : "특수학교종일반 학급수", column : "SPCLY_ADY_CCCCL_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "특수학교종일반 참여학생수", column : "SPCLY_ADY_PTPT_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "방과후학교 수익자부담금액", column : "ASL_BNFR_BRDN_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "방과후학교 수익자부담외지원금액", column : "ASL_BNFR_BRDN_EXCL_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "초등돌봄교실 수익자부담금액", column : "ECC_BNFR_BRDN_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "초등돌봄교실 수익자부담외지원금액", column : "ECC_BNFR_BRDN_EXCL_AMT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "프로그램수/교실수/학급수 - 개, 학생수 - 명, 금액 - 원";
			
			break;
			
		case "61"://61	학생·학부모 상담 계획 및 실시현황
			if(pbanYr > 2023){
				var columns = [{ label : "상담실적(내부상담전문가)", column : "COSE_CNSL_TLGM_TCR_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "상담실적(내부상담전문가실시여부)", column : "INNER_CNSL_SPLST_OPER_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "상담실적(외부상담전문가)", column : "COSE_CNSL_EXTRL_SPLST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "상담실적(외부상담전문가실시여부)", column : "EXTRL_CNSL_SPLST_OPER_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "교내 WEE클래스 설치여부", column : "WEE_CINSTL_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			}else{
				var columns = [{ label : "상담실적(내부상담전문가)", column : "COSE_CNSL_TLGM_TCR_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
				, { label : "상담실적(내부상담전문가실시여부)", column : "INNER_CNSL_SPLST_OPER_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
				, { label : "상담실적(외부상담전문가)", column : "COSE_CNSL_EXTRL_SPLST_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
				, { label : "상담실적(외부상담전문가실시여부)", column : "EXTRL_CNSL_SPLST_OPER_YN", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];	
			}
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "건";
			
			break;
			
		case "68"://68	직원 현황
			var columns = [{ label : "일반직(남)", column : "FRL_GEP_ML_STAFF_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "일반직(여)", column : "FRL_GEP_FML_STAFF_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "일반직(계)", column : "SUM_1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "별정직(남)", column : "FRL_PGP_ML_STAFF_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2018", kind : "" }
						, { label : "별정직(여)", column : "FRL_PGP_FML_STAFF_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2018", kind : "" }
						, { label : "별정직(계)", column : "SUM_2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2018", kind : "" }
						, { label : "기타직(남)", column : "FTEMP_ETC_ML_STAFF_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
						, { label : "기타직(여)", column : "FTEMP_ETC_FML_STAFF_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
						, { label : "기타직계", column : "SUM_3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
						, { label : "교육공무직(남)", column : "FTEMP_ETC_ML_STAFF_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
						, { label : "교육공무직(여)", column : "FTEMP_ETC_FML_STAFF_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
						, { label : "교육공무직(계)", column : "SUM_3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "명";
			
			break;
			
		case "73"://73	교복 구매 유형 및 단가
			var columns = [{ label : "동복구매방식(학교주관구매)", column : "COL_1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "동복구매방식(공동구매)", column : "COL_2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "동복구매방식(개별구매)", column : "COL_3", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "동복구매방식(기타)", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "동복구매방식(기타사유)", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "동복구매방식(해당없음)", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "동복(평균)가격", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "하복구매방식(학교주관구매)", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "하복구매방식(공동구매)", column : "COL_9", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "하복구매방식(개별구매)", column : "COL_10", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "하복구매방식(기타)", column : "COL_11", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "하복구매방식(기타사유)", column : "COL_12", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "하복구매방식(해당없음)", column : "COL_13", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "하복(평균)가격", column : "COL_14", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "원";
			
			break;
			
		case "90"://90	학생의 체력 증진에 관한 사항
			var columns = [{ label : "학년", column : "GRADE", index : 0, rowspan : "2", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "성별", column : "SXDS_CODE", index : 0, rowspan : "2", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "심폐지구력", column : "mergeColumn01", index : 0, rowspan : "", colspan : "3", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "왕복오래달리기(회)", column : "CPM_STMN_SHRUN_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "오래달리기걷기(초)", column : "MIN_SEC_LNRUN_TM2", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "스텝검사(PEI)", column : "CPM_BZC_STEP_TEST_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "유연성", column : "mergeColumn02", index : 0, rowspan : "", colspan : "2", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "앉아윗몸앞으로굽히기(cm)", column : "FLBT_BKRCH_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "종합유연성(점)", column : "GNRLZ_FLBT_AVRG_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "근력·근지구력", column : "mergeColumn03", index : 0, rowspan : "", colspan : "3", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "(무릎대고)팔굽혀펴기(회)", column : "MUSED_PUS_NTS", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "윗몸말아올리기(회)", column : "MUSED_CLUP_NTS", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "악력(kg)", column : "MUSED_GRIP_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "순발력", column : "mergeColumn04", index : 0, rowspan : "", colspan : "2", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "50m달리기(초)", column : "RFLX_FIF_METE_RAC_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "제자리멀리뛰기(cm)", column : "RFLX_SLJ_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "비만", column : "mergeColumn05", index : 0, rowspan : "", colspan : "2", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "BMI(kg/㎡)", column : "BDFAT_BMI_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "체지방률(%fat)", column : "BDFAT_RAT", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "1등급(80~100점)", column : "mergeColumn06", index : 0, rowspan : "", colspan : "2", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "인원", column : "ONGRD_STDNT_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "%", column : "PER_1", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "2등급(60~79점)", column : "mergeColumn07", index : 0, rowspan : "", colspan : "2", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "인원", column : "TWGRD_STDNT_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "%", column : "PER_2", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "3등급(40~59점)", column : "mergeColumn08", index : 0, rowspan : "", colspan : "2", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "인원", column : "THGRD_STDNT_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "%", column : "PER_3", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "4등급(20~39점)", column : "mergeColumn09", index : 0, rowspan : "", colspan : "2", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "인원", column : "FOGRD_STDNT_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "%", column : "PER_4", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "5등급(0~19점)", column : "mergeColumn10", index : 0, rowspan : "", colspan : "2", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "인원", column : "FIGRD_STDNT_FGR", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						, { label : "%", column : "PER_5", index : 1, rowspan : "", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }
						
						, { label : "검사인원수", column : "RATE_SUM", index : 0, rowspan : "2", colspan : "", schulKndCode : "02,03,04", startDate : "", endDate : "", kind : "" }];
			
			var newBaseColumns = updateBaseColumns(baseColumns, "rowspan", "2"); // bascolumns의 rowspan 값을 2로 업데이트
			columns = $.merge( $.merge( [], newBaseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			baseSchulKnd["05"]["use"] = "N"; // 특수학교 사용 안함
			baseSchulKnd["06"]["use"] = "N"; // 그외학교 사용 안함
			baseSchulKnd["07"]["use"] = "N"; // 각종학교 사용 안함
			unitText = "인원 - 명";

			break;
			
		case "38"://38	보건관리 현황
			var columns = [{ label : "연간보건실 이용건수", column : "ALL_IFRMA_UTILZ_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "전체학생수", column : "HAKSAENGSU_TOT", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "연간1인당 보건실이용건수", column : "WIK_AVRG_IFRMA_UTILZ_STDNT_FGR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : ""  }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "건수 - 건, 학생수 - 명";
			
			break;
			
		case "42"://42	환경위생관리 현황
			if(pbanYr >= 2024) {
				var columns = [{ label : "상하반기구분", column : "SEM_STR", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "2021", endDate : "9999", kind : "" }
				
				            , { label : "공기질/수질 구분", column : "CHCK_TRGT_STR", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
				            , { label : "점검장소명", column : "PNF_CHCK_PLACE_NM", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
				            , { label : "점검장소코드명", column : "PNF_CHCK_PLACE_SC_NM", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
  
				            , { label : "자연환기 적합여부", column : "NAT_VNTLA_STB_YN", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "0", endDate : "9999", kind : "" }
				
							, { label : "정수기 적합여부", column : "WTERR_STB_YN", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "0", endDate : "9999", kind : "" }
							
							, { label : "지하수 적합여부", column : "UGWTR_STB_YN", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "0", endDate : "9999", kind : "" }
							
							, { label : "칠판면 300(lux)이상", column : "mergeColumn01", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "BLKB_ITENI_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "BLKB_ITENI_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "BLKB_ITENI_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
						
							, { label : "책상면 300(lux)이상", column : "mergeColumn02", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "DES_ITENI_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "DES_ITENI_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "DES_ITENI_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "조도비 (최대/최소)3이하", column : "mergeColumn03", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "ITENI_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "ITENI_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "ITENI_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "이산화탄소(CO2) 1500(ppm)이하", column : "mergeColumn08", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "CO2_1500_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "CO2_1500_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "CO2_1500_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "이산화탄소(CO2) 1000(ppm)이하", column : "mergeColumn55", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "CO2_1000_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "CO2_1000_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "CO2_1000_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "폼알데하이드(HCHO) 100(㎍/㎥)이하", column : "mergeColumn09", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "HCHO_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치 ", column : "HCHO_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치 ", column : "HCHO_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "총휘발성유기화합물(TVOC) 400(㎍/㎥)이하", column : "mergeColumn10", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "VOCS_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "VOCS_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "VOCS_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "석면 0.01(개/cc)이하", column : "mergeColumn11", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "ASBESTOS_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "ASBESTOS_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "ASBESTOS_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "소음 55(dB(A))이하", column : "mergeColumn12", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "NSE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "NSE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "NSE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "미세먼지(PM10) 75(㎍/㎥)이하", column : "mergeColumn14", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "MNUT_DST_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "MNUT_DST_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "MNUT_DST_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "미세먼지(PM10) 150(㎍/㎥)이하", column : "mergeColumn11", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "GMNSM_MNUT_DST_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "GMNSM_MNUT_DST_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "GMNSM_MNUT_DST_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "미세먼지(PM2.5) 35(㎍/㎥)이하", column : "mergeColumn12", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "ULTRA_DST_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "ULTRA_DST_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "ULTRA_DST_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "포름알데히드(HCHO) 100(㎍/㎥)이하", column : "mergeColumn14", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "HCHO_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "HCHO_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "HCHO_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "총부유세균 800(CFU/㎥)이하", column : "mergeColumn15", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부하", column : "AIR_BACT_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "AIR_BACT_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "AIR_BACT_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "라돈 148(Bq/㎥)이하", column : "mergeColumn19", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "RN_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "RN_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "RN_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "오존(O3) 0.06(ppm)이하", column : "mergeColumn22", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "O3_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "O3_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "O3_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							 
							, { label : "총휘발성유기화합물(TVOC) 400(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "VOCS_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "VOCS_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "VOCS_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "벤젠 30(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "BENZENE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "BENZENE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "BENZENE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "톨루엔 1000(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "TOLUENE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "TOLUENE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "TOLUENE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "에틸벤젠 360(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "ETHY_BENZENE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "ETHY_BENZENE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "ETHY_BENZENE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "자일렌 700(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "XYLENE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "XYLENE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "XYLENE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "스틸렌 300(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "STYLENE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "STYLENE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "STYLENE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "석면 0.01(개/cc)이하", column : "mergeColumn21", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "ASBESTOS_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "ASBESTOS_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "ASBESTOS_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "일산화탄소(CO) 10(ppm)이하", column : "mergeColumn17", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "CO_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "CO_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "CO_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "이산화질소(NO2) 0.05(ppm)이하", column : "mergeColumn18", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "NO2_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "NO2_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "NO2_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "낙하세균 10(CFU/㎥)이하", column : "mergeColumn16", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "FALL_BACT_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "FALL_BACT_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "최종 결과치", column : "FALL_BACT_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							
							, { label : "진드기 100(마리/㎥)이하", column : "mergeColumn23", index : 0, rowspan : "", colspan : "3", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "진드기 적합여부", column : "MITE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "진드기 1차 결과치", column : "MITE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }
							, { label : "진드기 최종 결과치", column : "MITE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2024", endDate : "9999", kind : "" }];

			}else {
				var columns = [
				              { label : "상하반기구분", column : "SEM_STR", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "2021", endDate : "9999", kind : "" }
				              
				            , { label : "자연환기 적합여부", column : "NAT_VNTLA_STB_YN", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "0", endDate : "9999", kind : "" }
				
							, { label : "기계환기", column : "mergeColumn01", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "적합여부", column : "VNTLA_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "최종결과치 21.6(㎥/h)이상", column : "VNTLA_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							
							, { label : "칠판면", column : "mergeColumn02", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "적합여부", column : "BLKB_ITENI_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "최종결과치 300(lux)이상", column : "BLKB_ITENI_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							
							, { label : "책상면", column : "mergeColumn03", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "적합여부", column : "DES_ITENI_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "최종결과치 300(lux)이상", column : "DES_ITENI_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							
							, { label : "조도비", column : "mergeColumn04", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "적합여부", column : "ITENI_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "최종결과치 (최대/최소)3이하", column : "ITENI_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							
							, { label : "기계환기 21.6(㎥/h)이상", column : "mergeColumn01", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "VNTLA_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "최종결과치", column : "VNTLA_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "칠판면 300(lux)이상", column : "mergeColumn02", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "BLKB_ITENI_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "최종결과치", column : "BLKB_ITENI_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "책상면 300(lux)이상", column : "mergeColumn03", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "DES_ITENI_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "최종결과치", column : "DES_ITENI_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "조도비 (최대/최소)3이하", column : "mergeColumn04", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "ITENI_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "최종결과치", column : "ITENI_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "정수기 적합여부", column : "WTERR_STB_YN", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "0", endDate : "9999", kind : "" }
							
							, { label : "지하수 적합여부", column : "UGWTR_STB_YN", index : 0, rowspan : "2", colspan : "", schulKndCode : "", startDate : "0", endDate : "9999", kind : "" }
							
							, { label : "미세먼지", column : "mergeColumn05", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "적합여부", column : "MNUT_DST_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "최종결과치 100(㎍/㎥)이하", column : "MNUT_DST_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							
							, { label : "이산화탄소(CO2)", column : "mergeColumn06", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "이산화탄소(CO2) - 적합여부", column : "CO2_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "이산화탄소(CO2) - 최종결과치 1500(ppm)이하", column : "CO2_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							
							, { label : "포름알데히드(HCHO)", column : "mergeColumn07", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "포름알데히드(HCHO) - 적합여부", column : "HCHO_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "포름알데히드(HCHO) - 최종결과치 100(㎍/㎥)이하", column : "HCHO_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							
							, { label : "총휘발성유기화합물(TVOC)", column : "mergeColumn08", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "총휘발성유기화합물(TVOC) - 적합여부", column : "VOCS_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "총휘발성유기화합물(TVOC) - 최종결과치 400(㎍/㎥)이하", column : "VOCS_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							
							, { label : "석면", column : "mergeColumn09", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "적합여부", column : "ASBESTOS_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "최종결과치 0.01(개/cc)이하", column : "ASBESTOS_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							
							, { label : "소음", column : "mergeColumn10", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "적합여부", column : "NSE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "최종결과치 55(dB(A))이하", column : "NSE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							
							, { label : "소음 55(dB(A))이하", column : "mergeColumn24", index : 0, rowspan : "", colspan : "2", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "NSE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "최종결과치", column : "NSE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "미세먼지(PM10) 75(㎍/㎥)이하", column : "mergeColumn11", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "2020", kind : "" }
							, { label : "미세먼지(PM10)-교실 75(㎍/㎥)이하", column : "mergeColumn11", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2021", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "MNUT_DST_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "MNUT_DST_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "MNUT_DST_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "MNUT_DST_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "미세먼지(PM10)-체육관 150(㎍/㎥)이하", column : "mergeColumn11", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2021", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "GMNSM_MNUT_DST_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2021", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "GMNSM_MNUT_DST_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2021", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "GMNSM_MNUT_DST_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2021", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "GMNSM_MNUT_DST_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2021", endDate : "9999", kind : "" }
							
							, { label : "미세먼지(PM2.5) 35(㎍/㎥)이하", column : "mergeColumn12", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "ULTRA_DST_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "ULTRA_DST_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "ULTRA_DST_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "ULTRA_DST_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "포름알데히드(HCHO) 100(㎍/㎥)이하", column : "mergeColumn14", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "2021", kind : "" }
							, { label : "폼알데하이드(HCHO) 100(㎍/㎥)이하", column : "mergeColumn14", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2022", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "HCHO_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "HCHO_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "HCHO_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "HCHO_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "이산화탄소(CO2) 1500(ppm)이하", column : "mergeColumn13", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "CO2_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "CO2_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "CO2_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "CO2_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "총부유세균 800(CFU/㎥)이하", column : "mergeColumn15", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "AIR_BACT_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "AIR_BACT_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "AIR_BACT_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "AIR_BACT_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							
							, { label : "라돈  148(Rn) (pCi/L)이하", column : "mergeColumn19", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "RN_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "RN_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "RN_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "RN_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "오존(O3) 0.06(ppm)이하", column : "mergeColumn22", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "O3_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "O3_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "O3_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "O3_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							 
							, { label : "총휘발성유기화합물(TVOC) 400(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "VOCS_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "VOCS_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "VOCS_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "VOCS_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "벤젠 30(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "BENZENE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "BENZENE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "BENZENE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "BENZENE_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "톨루엔 1000(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "TOLUENE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "TOLUENE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "TOLUENE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "TOLUENE_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "에틸벤젠 360(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "ETHY_BENZENE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "ETHY_BENZENE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "ETHY_BENZENE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "ETHY_BENZENE_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "자일렌 700(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "XYLENE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "XYLENE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "XYLENE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "XYLENE_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "스틸렌 300(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "2021", kind : "" }
							, { label : "스티렌 300(㎍/㎥)이하", column : "mergeColumn20", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2022", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "STYLENE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "STYLENE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "STYLENE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "STYLENE_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "석면 0.01(개/cc)이하", column : "mergeColumn21", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "ASBESTOS_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "ASBESTOS_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "ASBESTOS_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "ASBESTOS_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "일산화탄소(CO) 10(ppm)이하", column : "mergeColumn17", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "CO_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "CO_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "CO_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "CO_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "이산화질소(NO2) 0.05(ppm)이하", column : "mergeColumn18", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "NO2_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "NO2_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "NO2_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "NO2_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "낙하세균 10(CFU/㎥)이하", column : "mergeColumn16", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "FALL_BACT_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "FALL_BACT_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "FALL_BACT_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "FALL_BACT_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "진드기 100(마리/㎥)이하", column : "mergeColumn23", index : 0, rowspan : "", colspan : "4", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "적합여부", column : "MITE_STB_YN", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "1차 결과치", column : "MITE_RSLT_NMVL", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "2차 결과치", column : "MITE_RSLT_NMVL_2", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "3차 결과치", column : "MITE_RSLT_NMVL_3", index : 1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }];
			}	
						
						
			
			var newBaseColumns = updateBaseColumns(baseColumns, "rowspan", "2"); // bascolumns의 rowspan 값을 2로 업데이트
			columns = $.merge( $.merge( [], newBaseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			
			break;
			
		case "44"://44	시설안전 점검 현황
			var columns = [{ label : "최종점검일자", column : "CK_YMD", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "대장명", column : "CK_BBOOK_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "관리유무", column : "CK_RSLT_CODE", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
						, { label : "비고", column : "NOTE_MATR", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			
			break;
			
		case "43"://43	안전교육 계획 및 실시 현황
			var headRowCnt = 2;
			var headRowCnt1 = 1;
			var headIndex0 = 0 ;
			var headIndex1 = 1 ;
			var headIndex2 = 2 ;
			if(pbanYr >= 2017) {
				var columns = [{ label : "전체학급수", column : "CLASS_COUNT", index : 0, rowspan : headRowCnt, colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "전체학생수", column : "PBAN_YR_ALL_STDNT_FGR", index : 0, rowspan : headRowCnt, colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							
							, { label : "생활안전교육 시간(단위활동차시)", column : "mergeColumn01", index : 0, rowspan : headRowCnt1, colspan : "3", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "생활안전교육 시간(단위활동차시)-1학기", column : "LVLH_SAFE_EDC_HR_FGR1", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "생활안전교육 시간(단위활동차시)-2학기", column : "LVLH_SAFE_EDC_HR_FGR2", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "생활안전교육 시간(단위활동차시)-합계", column : "LVLH_SAFE_EDC_TOTAL", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							
							, { label : "교통안전교육 시간(단위활동차시)", column : "mergeColumn02", index : 0, rowspan : headRowCnt1, colspan : "3", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "교통안전교육 시간(단위활동차시)-1학기", column : "TRFC_SAFE_EDC_HR_FGR1", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "교통안전교육 시간(단위활동차시)-2학기", column : "TRFC_SAFE_EDC_HR_FGR2", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "교통안전교육 시간(단위활동차시)-합계", column : "TRFC_SAFE_EDC_TOTAL", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							
							, { label : "폭력예방및신변보호교육 시간(단위활동차시)", column : "mergeColumn03", index : 0, rowspan :headRowCnt1, colspan : "3", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "폭력예방및신변보호교육 시간(단위활동차시)-1학기", column : "VIO_PRVT_BDY_PRTC_EDC_HR_FGR1", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "폭력예방및신변보호교육 시간(단위활동차시)-2학기", column : "VIO_PRVT_BDY_PRTC_EDC_HR_FGR2", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "폭력예방및신변보호교육 시간(단위활동차시)-합계", column : "VIO_PRVT_BDY_PRTC_EDC_TOTAL", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							
							, { label : "약물및사이버중독예방교육 시간(단위활동차시)", column : "mergeColumn04", index : 0, rowspan : headRowCnt1, colspan : "3", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "약물및사이버중독예방교육 시간(단위활동차시)-1학기(2018, 2019년)", column : "DRU_CYBER_PRVT_EDC_HR_FGR1", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "약물및사이버중독예방교육 시간(단위활동차시)-2학기(2018, 2019년)", column : "DRU_CYBER_PRVT_EDC_HR_FGR2", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "약물및사이버중독예방교육 시간(단위활동차시)-합계(2018, 2019년)", column : "DRU_CYBER_PRVT_EDC_TOTAL", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
	
							, { label : "약물중독예방교육 시간(단위활동차시)", column : "mergeColumn05_01", index : 0, rowspan : headRowCnt1, colspan : "3", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "약물중독예방교육 시간(단위활동차시) - 1학기 (2020년 이후)", column : "DRU_CYBER_PRVT_EDC_HR_FGR1", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "약물중독예방교육 시간(단위활동차시) - 2학기 (2020년 이후)", column : "DRU_CYBER_PRVT_EDC_HR_FGR2", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							, { label : "약물중독예방교육 시간(단위활동차시) - 합계 (2020년 이후)", column : "DRU_CYBER_PRVT_EDC_TOTAL", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "9999", kind : "" }
							
							, { label : "사이버중독예방교육 시간(단위활동차시)", column : "mergeColumn05_02", index : 0, rowspan : headRowCnt1, colspan : "3", schulKndCode : "", startDate : "2020", endDate : "2022", kind : "" }
							, { label : "사이버중독예방교육 시간(단위활동차시) - 1학기 (2020, 2021, 2022년)", column : "CYBER_PRVT_EDC_HR_FGR1", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "2022", kind : "" }
							, { label : "사이버중독예방교육 시간(단위활동차시) - 2학기 (2020, 2021, 2022년)", column : "CYBER_PRVT_EDC_HR_FGR2", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "2022", kind : "" }
							, { label : "사이버중독예방교육 시간(단위활동차시) - 합계 (2020, 2021, 2022년)", column : "CYBER_PRVT_EDC_TOTAL", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2020", endDate : "2022", kind : "" }
	
							, { label : "지능정보서비스과의존관련교육 시간(단위활동차시)", column : "mergeColumn05_02", index : 0, rowspan : headRowCnt1, colspan : "3", schulKndCode : "", startDate : "2023", endDate : "9999", kind : "" }
							, { label : "지능정보서비스과의존관련교육 시간(단위활동차시) - 1학기 (2023년 이후)", column : "CYBER_PRVT_EDC_HR_FGR1", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2023", endDate : "9999", kind : "" }
							, { label : "지능정보서비스과의존관련교육 시간(단위활동차시) - 2학기 (2023년 이후)", column : "CYBER_PRVT_EDC_HR_FGR2", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2023", endDate : "9999", kind : "" }
							, { label : "지능정보서비스과의존관련교육 시간(단위활동차시) - 합계 (2023년 이후)", column : "CYBER_PRVT_EDC_TOTAL", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "2023", endDate : "9999", kind : "" }
	
							, { label : "재난안전교육 시간(단위활동차시)", column : "mergeColumn06", index : 0, rowspan : headRowCnt1, colspan : "3", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "재난안전교육 시간(단위활동차시)-1학기", column : "DISA_SAFE_EDC_HR_FGR1", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "재난안전교육 시간(단위활동차시)-2학기", column : "DISA_SAFE_EDC_HR_FGR2", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "재난안전교육 시간(단위활동차시)-합계", column : "DISA_SAFE_EDC_TOTAL", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							
							, { label : "직업안전교육 시간(단위활동차시)", column : "mergeColumn07", index : 0, rowspan : headRowCnt1, colspan : "3", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "직업안전교육 시간(단위활동차시)-1학기", column : "OCCP_SAFE_EDC_HR_FGR1", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "직업안전교육 시간(단위활동차시)-2학기", column : "OCCP_SAFE_EDC_HR_FGR2", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "직업안전교육 시간(단위활동차시)-합계", column : "OCCP_SAFE_EDC_TOTAL", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							
							, { label : "응급처치교육 시간(단위활동차시)", column : "mergeColumn08", index : 0, rowspan :headRowCnt1, colspan : "3", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "응급처치교육 시간(단위활동차시)-1학기", column : "EMGN_MDLRT_EDC_HR_FGR1", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "응급처치교육 시간(단위활동차시)-2학기", column : "EMGN_MDLRT_EDC_HR_FGR2", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "응급처치교육 시간(단위활동차시)-합계", column : "EMGN_MDLRT_EDC_TOTAL", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			}else{
				var columns = [{ label : "전체학급수", column : "CLASS_COUNT", index : 0, rowspan : headRowCnt, colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "전체학생수", column : "PBAN_YR_ALL_STDNT_FGR", index : 0, rowspan : headRowCnt, colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							
							, { label : "교육과정내", column : "mergeColumn01", index : 0, rowspan : headRowCnt1, colspan : "7", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "재난안전", column : "SAFE_EDC_INNER_TM_001", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "생활안전", column : "SAFE_EDC_INNER_TM_002", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "교통안전", column : "SAFE_EDC_INNER_TM_003", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "폭력및신변안전", column : "SAFE_EDC_INNER_TM_004", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "약물·유해물질안전/인터넷중독예방", column : "SAFE_EDC_INNER_TM_005", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "직업안전", column : "SAFE_EDC_INNER_TM_006", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "응급처치", column : "SAFE_EDC_INNER_TM_007", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							
							, { label : "교육과정외", column : "mergeColumn02", index : 0, rowspan : headRowCnt1, colspan : "7", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "재난안전", column : "SAFE_EDC_EXTRL_TM_001", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "생활안전", column : "SAFE_EDC_EXTRL_TM_002", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "교통안전", column : "SAFE_EDC_EXTRL_TM_003", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "폭력및신변안전", column : "SAFE_EDC_EXTRL_TM_004", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "약물·유해물질안전/인터넷중독예방", column : "SAFE_EDC_EXTRL_TM_005", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "직업안전", column : "SAFE_EDC_EXTRL_TM_006", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "응급처치", column : "SAFE_EDC_EXTRL_TM_007", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							
							, { label : "합계", column : "mergeColumn03", index : 0, rowspan :headRowCnt1, colspan : "8", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "재난안전", column : "TOTAL_TM_001", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "생활안전", column : "TOTAL_TM_002", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "교통안전", column : "TOTAL_TM_003", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "폭력및신변안전", column : "TOTAL_TM_004", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "약물·유해물질안전/인터넷중독예방", column : "TOTAL_TM_005", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "직업안전", column : "TOTAL_TM_006", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "응급처치", column : "TOTAL_TM_007", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "전체총계", column : "TOTAL_TM_008", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }

							
							, { label : "평균", column : "mergeColumn04", index : 0, rowspan : headRowCnt1, colspan : "3", schulKndCode : "", startDate : "0", endDate : "2019", kind : "" }
							, { label : "재난안전", column : "AVG_TM_001", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "생활안전", column : "AVG_TM_002", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "교통안전", column : "AVG_TM_003", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "폭력및신변안전", column : "AVG_TM_004", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "약물·유해물질안전/인터넷중독예방", column : "AVG_TM_005", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "직업안전", column : "AVG_TM_006", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "응급처치", column : "AVG_TM_007", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
							, { label : "전체총계", column : "AVG_TM_008", index : headIndex1, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];

				}
			
			var newBaseColumns = updateBaseColumns(baseColumns, "rowspan", headRowCnt); // bascolumns의 rowspan 값을 2로 업데이트
			columns = $.merge( $.merge( [], newBaseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText = "차시";

			break;
			
		case "04"://04	자유학기제 운영에 관한 사항
			var columns = [{ label : "자유학기제 운영학기", column : "COL_P", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			, { label : "자유학기활동(주제선택활동)", column : "COL_5", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			, { label : "자유학기활동(예술체육활동)", column : "COL_6", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			, { label : "자유학기활동(동아리활동)", column : "COL_7", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			, { label : "자유학기활동(진로탐색활동)", column : "COL_4", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			, { label : "자유학기활동(소계)", column : "COL_8", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "10", columns : columns }, { depth : "20", columns : columns } ];
			baseSchulKnd["02"]["use"] = "N"; // 초등학교 사용 안함
			baseSchulKnd["04"]["use"] = "N"; // 고등학교 사용 안함
			baseSchulKnd["05"]["use"] = "N"; // 특수학교 사용 안함
			baseSchulKnd["06"]["use"] = "N"; // 그외학교 사용 안함
			baseSchulKnd["07"]["use"] = "N"; // 각종학교 사용 안함
			unitText = {"10" : "1시수 - 45분으로 환산", "20" : "1시수 - 45분으로 환산" };

			break;
			
		case "94"://94 대상별 학교폭력 예방교육 실적
			var columns = [{label : "구분", column : "SEM_SC_NM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : ""  }
			
			, {label : "학생 정규 교과 수업", column : "FRL_CURR_ITRT_TM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2020", kind : ""  }
			, {label : "학생 정규 교과 수업 외", column : "NN_FRL_CURR_ITRT_TM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2020", kind : ""  }
			
			, {label : "학생 정규 수업", column : "FRL_CURR_ITRT_TM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2021", endDate : "9999", kind : ""  }
			, {label : "학생 정규 수업 외", column : "NN_FRL_CURR_ITRT_TM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2021", endDate : "9999", kind : ""  }
			, {label : "학생 평균 교육 시간(1학급당)", column : "TOT_AVG_TM", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }

			, {label : "교원 횟수", column : "PTPT_NTS1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			, {label : "교원 참여인원", column : "PTPT_NMPR_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			
			, {label : "교원 참여비율", column : "PTPT_NMPR_PER1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			, {label : "학부모 횟수", column : "PTPT_NTS2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			, {label : "학부모 참여인원", column : "PTPT_NMPR_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			, {label : "학부모 참여비율", column : "PTPT_NMPR_PER2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "", endDate : "", kind : "" }
			, {label : "지도교사수-또래조정(또래활동)", column : "SMAGE_MDAT_NMPR_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2021", kind : "" }
			
			, {label : "지도교사수-또래상담", column : "SMAGE_CNSL_NMPR_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2021", kind : "" }
			, {label : "지도교사수-자치법정", column : "ATMY_LEGAL_NMPR_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2021", kind : "" }
			, {label : "지도교사수-또래보호 등 기타 학생자치활동", column : "ETC_NMPR_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2021", kind : "" }
			, {label : "참여학생수-또래조정(또래활동)", column : "SMAGE_MDAT_NMPR_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2021", kind : "" }
			, {label : "참여학생수-또래상담", column : "SMAGE_CNSL_NMPR_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2021", kind : "" }
			
			, {label : "참여학생수-자치법정", column : "ATMY_LEGAL_NMPR_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2021", kind : "" }
			, {label : "참여학생수-또래보호 등 기타 학생자치활동", column : "ETC_NMPR_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "0", endDate : "2021", kind : "" }
			, {label : "지도교사수-동아리·학생자치활동", column : "SMAGE_MDAT_NMPR_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2022", endDate : "9999", kind : "" }
			, {label : "지도교사수-또래활동", column : "SMAGE_CNSL_NMPR_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2022", endDate : "9999", kind : "" }
			, {label : "지도교사수-교육주간 활동", column : "ATMY_LEGAL_NMPR_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2022", endDate : "9999", kind : "" }
			
			, {label : "지도교사수-기타 학교폭력 예방활동", column : "ETC_NMPR_FGR1", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2022", endDate : "9999", kind : "" }
			, {label : "참여학생수-동아리·학생자치활동", column : "SMAGE_MDAT_NMPR_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2022", endDate : "9999", kind : "" }
			, {label : "참여학생수-또래활동", column : "SMAGE_CNSL_NMPR_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2022", endDate : "9999", kind : "" }
			, {label : "참여학생수-교육주간 활동", column : "ATMY_LEGAL_NMPR_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2022", endDate : "9999", kind : "" }
			, {label : "참여학생수-기타 학교폭력 예방활동", column : "ETC_NMPR_FGR2", index : 0, rowspan : "", colspan : "", schulKndCode : "", startDate : "2022", endDate : "9999", kind : "" }];
			
			columns = $.merge( $.merge( [], baseColumns ), columns );
			tableHeadInfo = [ { depth : "0", columns : columns } ];
			unitText="학생정규수업/학생정규수업외/학생평균교육시간(1학급당) - 분, 횟수 - 회, 인원/교사수/학생수 - 명, 비율 - %";

			break;
		
		default:
			break;
	}
	
}

// baseColumns의 값을 업데이트 한다.
function updateBaseColumns(baseColumns, targetKey, targetValue) {
	var tmpBaseColumns = baseColumns;
	$.each(tmpBaseColumns, function(idx, obj) {
		$.each(obj, function(key, value) {
			if( key == targetKey ) {
				obj[key] = targetValue;
			}
		});
	});
	
	return tmpBaseColumns;
}