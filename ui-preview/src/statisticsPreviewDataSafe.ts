export type StatisticsSchoolItem = {
  rank: number;
  schoolName: string;
  districtName: string;
  casePolicyLabel: string;
  caseStatusLabel: string;
  potentialDemand2029: number;
  potentialDemand2031: number;
  nearestParkDistanceM: number;
  greenRatio: number;
  playgroundCount: number;
};

export type DistrictStatistics = {
  districtName: string;
  schoolCount: number;
  case1Count: number;
  case2Count: number;
  case3Count: number;
  case4Count: number;
  specialPolicyCount: number;
  priorityReviewCount: number;
  totalPotentialDemand2029: number;
  totalPotentialDemand2031: number;
  avgNearestParkDistanceM: number;
  avgGreenRatio: number;
  avgPlaygroundCount: number;
  topPrioritySchools: StatisticsSchoolItem[];
  bestSchool: StatisticsSchoolItem;
};

export type CityStatisticsData = {
  cityName: string;
  summary: {
    schoolCount: number;
    districtCount: number;
    urgentSupportCount: number;
    priorityReviewCount: number;
    totalPotentialDemand2029: number;
    totalPotentialDemand2031: number;
  };
  districts: DistrictStatistics[];
  cityTopPrioritySchools: StatisticsSchoolItem[];
  cityBestSchool: StatisticsSchoolItem;
};

export const cityStatisticsPreviewDataSafe: CityStatisticsData = {
  "cityName": "인천광역시",
  "summary": {
    "schoolCount": 272,
    "districtCount": 10,
    "urgentSupportCount": 13,
    "priorityReviewCount": 77,
    "totalPotentialDemand2029": 75803,
    "totalPotentialDemand2031": 76158
  },
  "districts": [
    {
      "districtName": "중구",
      "schoolCount": 16,
      "case1Count": 2,
      "case2Count": 3,
      "case3Count": 2,
      "case4Count": 8,
      "specialPolicyCount": 1,
      "priorityReviewCount": 5,
      "totalPotentialDemand2029": 2244,
      "totalPotentialDemand2031": 2148,
      "avgNearestParkDistanceM": 583.1,
      "avgGreenRatio": 12.5,
      "avgPlaygroundCount": 1.19,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천신선초등학교",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 120,
          "potentialDemand2031": 116,
          "nearestParkDistanceM": 579.7,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천용유초등학교",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 30,
          "potentialDemand2031": 29,
          "nearestParkDistanceM": 4482.3,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천신광초등학교",
          "districtName": "중구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 268,
          "potentialDemand2031": 259,
          "nearestParkDistanceM": 61.3,
          "greenRatio": 0.0,
          "playgroundCount": 1
        },
        {
          "rank": 4,
          "schoolName": "인천신흥초등학교",
          "districtName": "중구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 154,
          "potentialDemand2031": 149,
          "nearestParkDistanceM": 121.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천연안초등학교",
          "districtName": "중구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 30,
          "potentialDemand2031": 29,
          "nearestParkDistanceM": 416.6,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천중산초등학교",
        "districtName": "중구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 242,
        "potentialDemand2031": 230,
        "nearestParkDistanceM": 55.7,
        "greenRatio": 95.9,
        "playgroundCount": 1
      }
    },
    {
      "districtName": "동구",
      "schoolCount": 8,
      "case1Count": 1,
      "case2Count": 4,
      "case3Count": 2,
      "case4Count": 1,
      "specialPolicyCount": 0,
      "priorityReviewCount": 5,
      "totalPotentialDemand2029": 2651,
      "totalPotentialDemand2031": 2722,
      "avgNearestParkDistanceM": 359.9,
      "avgGreenRatio": 1.3,
      "avgPlaygroundCount": 0.25,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천서림초등학교",
          "districtName": "동구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 405,
          "potentialDemand2031": 420,
          "nearestParkDistanceM": 728.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천동명초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 429,
          "potentialDemand2031": 446,
          "nearestParkDistanceM": 650.3,
          "greenRatio": 0.2,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천송현초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 383,
          "potentialDemand2031": 398,
          "nearestParkDistanceM": 182.0,
          "greenRatio": 0.2,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "영화초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 226,
          "potentialDemand2031": 235,
          "nearestParkDistanceM": 305.1,
          "greenRatio": 0.5,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천창영초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 202,
          "potentialDemand2031": 210,
          "nearestParkDistanceM": 43.4,
          "greenRatio": 0.5,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천만석초등학교",
        "districtName": "동구",
        "casePolicyLabel": "모니터링 대상",
        "caseStatusLabel": "접근 가능, 중간 수준",
        "potentialDemand2029": 136,
        "potentialDemand2031": 132,
        "nearestParkDistanceM": 110.6,
        "greenRatio": 1.6,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "미추홀구",
      "schoolCount": 23,
      "case1Count": 1,
      "case2Count": 10,
      "case3Count": 7,
      "case4Count": 5,
      "specialPolicyCount": 0,
      "priorityReviewCount": 11,
      "totalPotentialDemand2029": 9152,
      "totalPotentialDemand2031": 9478,
      "avgNearestParkDistanceM": 336.9,
      "avgGreenRatio": 6.9,
      "avgPlaygroundCount": 0.04,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천석암초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 562,
          "potentialDemand2031": 593,
          "nearestParkDistanceM": 947.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천대화초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 716,
          "potentialDemand2031": 755,
          "nearestParkDistanceM": 254.6,
          "greenRatio": 0.6,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천주안남초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 662,
          "potentialDemand2031": 698,
          "nearestParkDistanceM": 60.5,
          "greenRatio": 0.4,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천남부초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 642,
          "potentialDemand2031": 677,
          "nearestParkDistanceM": 305.0,
          "greenRatio": 0.6,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천경원초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 627,
          "potentialDemand2031": 662,
          "nearestParkDistanceM": 73.2,
          "greenRatio": 0.4,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천백학초등학교",
        "districtName": "미추홀구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 397,
        "potentialDemand2031": 419,
        "nearestParkDistanceM": 56.9,
        "greenRatio": 28.7,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "옹진군",
      "schoolCount": 10,
      "case1Count": 0,
      "case2Count": 0,
      "case3Count": 0,
      "case4Count": 0,
      "specialPolicyCount": 10,
      "priorityReviewCount": 0,
      "totalPotentialDemand2029": 0,
      "totalPotentialDemand2031": 0,
      "avgNearestParkDistanceM": 7142.8,
      "avgGreenRatio": 0.0,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "연평초등학교",
          "districtName": "옹진군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 0,
          "potentialDemand2031": 0,
          "nearestParkDistanceM": 2553.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "대청초등학교",
          "districtName": "옹진군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 0,
          "potentialDemand2031": 0,
          "nearestParkDistanceM": 2553.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "영흥초등학교",
          "districtName": "옹진군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 0,
          "potentialDemand2031": 0,
          "nearestParkDistanceM": 13519.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "덕적초등학교",
          "districtName": "옹진군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 0,
          "potentialDemand2031": 0,
          "nearestParkDistanceM": 12865.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "북포초등학교",
          "districtName": "옹진군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 0,
          "potentialDemand2031": 0,
          "nearestParkDistanceM": 2553.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "기준 충족 학교 없음",
        "districtName": "옹진군",
        "casePolicyLabel": "기준 미충족",
        "caseStatusLabel": "200m 이내 후보 없음",
        "potentialDemand2029": 0,
        "potentialDemand2031": 0,
        "nearestParkDistanceM": 0,
        "greenRatio": 0,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "부평구",
      "schoolCount": 42,
      "case1Count": 4,
      "case2Count": 13,
      "case3Count": 14,
      "case4Count": 11,
      "specialPolicyCount": 0,
      "priorityReviewCount": 17,
      "totalPotentialDemand2029": 18644,
      "totalPotentialDemand2031": 19261,
      "avgNearestParkDistanceM": 427.2,
      "avgGreenRatio": 5.3,
      "avgPlaygroundCount": 0.64,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천마장초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 524,
          "potentialDemand2031": 510,
          "nearestParkDistanceM": 839.7,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천부원초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 580,
          "potentialDemand2031": 620,
          "nearestParkDistanceM": 752.2,
          "greenRatio": 0.0,
          "playgroundCount": 7
        },
        {
          "rank": 3,
          "schoolName": "인천부마초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 565,
          "potentialDemand2031": 604,
          "nearestParkDistanceM": 801.4,
          "greenRatio": 0.0,
          "playgroundCount": 11
        },
        {
          "rank": 4,
          "schoolName": "인천미산초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 190,
          "potentialDemand2031": 185,
          "nearestParkDistanceM": 1143.0,
          "greenRatio": 0.0,
          "playgroundCount": 9
        },
        {
          "rank": 5,
          "schoolName": "인천부흥초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 974,
          "potentialDemand2031": 1042,
          "nearestParkDistanceM": 162.1,
          "greenRatio": 0.8,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천진산초등학교",
        "districtName": "부평구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 75,
        "potentialDemand2031": 73,
        "nearestParkDistanceM": 152.0,
        "greenRatio": 14.0,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "연수구",
      "schoolCount": 34,
      "case1Count": 2,
      "case2Count": 12,
      "case3Count": 6,
      "case4Count": 14,
      "specialPolicyCount": 0,
      "priorityReviewCount": 14,
      "totalPotentialDemand2029": 8823,
      "totalPotentialDemand2031": 8620,
      "avgNearestParkDistanceM": 413.6,
      "avgGreenRatio": 17.2,
      "avgPlaygroundCount": 0.47,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천은송초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 329,
          "potentialDemand2031": 320,
          "nearestParkDistanceM": 1575.0,
          "greenRatio": 0.0,
          "playgroundCount": 6
        },
        {
          "rank": 2,
          "schoolName": "인천송빛초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 64,
          "potentialDemand2031": 62,
          "nearestParkDistanceM": 1276.8,
          "greenRatio": 0.0,
          "playgroundCount": 6
        },
        {
          "rank": 3,
          "schoolName": "인천옥련초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 758,
          "potentialDemand2031": 739,
          "nearestParkDistanceM": 242.4,
          "greenRatio": 0.6,
          "playgroundCount": 2
        },
        {
          "rank": 4,
          "schoolName": "인천신정초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 625,
          "potentialDemand2031": 609,
          "nearestParkDistanceM": 270.5,
          "greenRatio": 0.7,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천능허대초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 596,
          "potentialDemand2031": 581,
          "nearestParkDistanceM": 204.8,
          "greenRatio": 0.9,
          "playgroundCount": 2
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천신송초등학교",
        "districtName": "연수구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 111,
        "potentialDemand2031": 108,
        "nearestParkDistanceM": 0.0,
        "greenRatio": 78.2,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "남동구",
      "schoolCount": 39,
      "case1Count": 0,
      "case2Count": 10,
      "case3Count": 15,
      "case4Count": 14,
      "specialPolicyCount": 0,
      "priorityReviewCount": 10,
      "totalPotentialDemand2029": 13069,
      "totalPotentialDemand2031": 12998,
      "avgNearestParkDistanceM": 244.4,
      "avgGreenRatio": 8.4,
      "avgPlaygroundCount": 0.59,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천인동초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 772,
          "potentialDemand2031": 752,
          "nearestParkDistanceM": 215.9,
          "greenRatio": 0.7,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천동부초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 674,
          "potentialDemand2031": 702,
          "nearestParkDistanceM": 147.6,
          "greenRatio": 0.4,
          "playgroundCount": 1
        },
        {
          "rank": 3,
          "schoolName": "상인천초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 601,
          "potentialDemand2031": 625,
          "nearestParkDistanceM": 473.0,
          "greenRatio": 0.1,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천정각초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 386,
          "potentialDemand2031": 376,
          "nearestParkDistanceM": 335.8,
          "greenRatio": 0.1,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천만수북초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 379,
          "potentialDemand2031": 394,
          "nearestParkDistanceM": 563.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천송천초등학교",
        "districtName": "남동구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 355,
        "potentialDemand2031": 346,
        "nearestParkDistanceM": 180.7,
        "greenRatio": 71.5,
        "playgroundCount": 1
      }
    },
    {
      "districtName": "계양구",
      "schoolCount": 27,
      "case1Count": 0,
      "case2Count": 8,
      "case3Count": 13,
      "case4Count": 5,
      "specialPolicyCount": 1,
      "priorityReviewCount": 8,
      "totalPotentialDemand2029": 7676,
      "totalPotentialDemand2031": 7686,
      "avgNearestParkDistanceM": 358.9,
      "avgGreenRatio": 2.8,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천화전초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 628,
          "potentialDemand2031": 642,
          "nearestParkDistanceM": 425.8,
          "greenRatio": 0.1,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천안남초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 579,
          "potentialDemand2031": 564,
          "nearestParkDistanceM": 436.0,
          "greenRatio": 0.3,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천부현초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 476,
          "potentialDemand2031": 464,
          "nearestParkDistanceM": 432.5,
          "greenRatio": 0.9,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천부평초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 454,
          "potentialDemand2031": 464,
          "nearestParkDistanceM": 144.2,
          "greenRatio": 0.7,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천효성동초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 362,
          "potentialDemand2031": 371,
          "nearestParkDistanceM": 691.3,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "경인교육대학교부설초등학교",
        "districtName": "계양구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 176,
        "potentialDemand2031": 180,
        "nearestParkDistanceM": 53.9,
        "greenRatio": 7.4,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "서구",
      "schoolCount": 53,
      "case1Count": 3,
      "case2Count": 17,
      "case3Count": 16,
      "case4Count": 17,
      "specialPolicyCount": 0,
      "priorityReviewCount": 20,
      "totalPotentialDemand2029": 13208,
      "totalPotentialDemand2031": 12937,
      "avgNearestParkDistanceM": 409.0,
      "avgGreenRatio": 6.7,
      "avgPlaygroundCount": 0.08,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천봉화초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 154,
          "potentialDemand2031": 150,
          "nearestParkDistanceM": 608.2,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천가석초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 57,
          "potentialDemand2031": 56,
          "nearestParkDistanceM": 1323.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천가정초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 57,
          "potentialDemand2031": 56,
          "nearestParkDistanceM": 663.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천봉수초등학교",
          "districtName": "서구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 609,
          "potentialDemand2031": 593,
          "nearestParkDistanceM": 446.5,
          "greenRatio": 0.0,
          "playgroundCount": 1
        },
        {
          "rank": 5,
          "schoolName": "인천신현초등학교",
          "districtName": "서구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 580,
          "potentialDemand2031": 587,
          "nearestParkDistanceM": 602.1,
          "greenRatio": 0.2,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천아라초등학교",
        "districtName": "서구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 140,
        "potentialDemand2031": 136,
        "nearestParkDistanceM": 166.0,
        "greenRatio": 16.5,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "강화군",
      "schoolCount": 20,
      "case1Count": 0,
      "case2Count": 0,
      "case3Count": 0,
      "case4Count": 0,
      "specialPolicyCount": 20,
      "priorityReviewCount": 0,
      "totalPotentialDemand2029": 336,
      "totalPotentialDemand2031": 308,
      "avgNearestParkDistanceM": 2748.5,
      "avgGreenRatio": 2.7,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "강화초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 136,
          "potentialDemand2031": 124,
          "nearestParkDistanceM": 0.0,
          "greenRatio": 2.3,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "합일초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 135,
          "potentialDemand2031": 123,
          "nearestParkDistanceM": 0.0,
          "greenRatio": 13.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "갑룡초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 49,
          "potentialDemand2031": 45,
          "nearestParkDistanceM": 285.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "화도초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 8,
          "potentialDemand2031": 8,
          "nearestParkDistanceM": 327.3,
          "greenRatio": 18.9,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "해명초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 8,
          "potentialDemand2031": 8,
          "nearestParkDistanceM": 327.3,
          "greenRatio": 18.9,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "합일초등학교",
        "districtName": "강화군",
        "casePolicyLabel": "별도 정책 적용",
        "caseStatusLabel": "별도 묶음",
        "potentialDemand2029": 135,
        "potentialDemand2031": 123,
        "nearestParkDistanceM": 0.0,
        "greenRatio": 13.0,
        "playgroundCount": 0
      }
    }
  ],
  "cityTopPrioritySchools": [
    {
      "rank": 1,
      "schoolName": "인천석암초등학교",
      "districtName": "미추홀구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 562,
      "potentialDemand2031": 593,
      "nearestParkDistanceM": 947.1,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 2,
      "schoolName": "인천마장초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 524,
      "potentialDemand2031": 510,
      "nearestParkDistanceM": 839.7,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 3,
      "schoolName": "인천부원초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 580,
      "potentialDemand2031": 620,
      "nearestParkDistanceM": 752.2,
      "greenRatio": 0.0,
      "playgroundCount": 7
    },
    {
      "rank": 4,
      "schoolName": "인천부마초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 565,
      "potentialDemand2031": 604,
      "nearestParkDistanceM": 801.4,
      "greenRatio": 0.0,
      "playgroundCount": 11
    },
    {
      "rank": 5,
      "schoolName": "인천서림초등학교",
      "districtName": "동구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 405,
      "potentialDemand2031": 420,
      "nearestParkDistanceM": 728.0,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 6,
      "schoolName": "인천은송초등학교",
      "districtName": "연수구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 329,
      "potentialDemand2031": 320,
      "nearestParkDistanceM": 1575.0,
      "greenRatio": 0.0,
      "playgroundCount": 6
    },
    {
      "rank": 7,
      "schoolName": "인천봉화초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 154,
      "potentialDemand2031": 150,
      "nearestParkDistanceM": 608.2,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 8,
      "schoolName": "인천신선초등학교",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 120,
      "potentialDemand2031": 116,
      "nearestParkDistanceM": 579.7,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 9,
      "schoolName": "인천미산초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 190,
      "potentialDemand2031": 185,
      "nearestParkDistanceM": 1143.0,
      "greenRatio": 0.0,
      "playgroundCount": 9
    },
    {
      "rank": 10,
      "schoolName": "인천용유초등학교",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 30,
      "potentialDemand2031": 29,
      "nearestParkDistanceM": 4482.3,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 11,
      "schoolName": "인천가석초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 57,
      "potentialDemand2031": 56,
      "nearestParkDistanceM": 1323.0,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 12,
      "schoolName": "인천가정초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 57,
      "potentialDemand2031": 56,
      "nearestParkDistanceM": 663.1,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 13,
      "schoolName": "인천송빛초등학교",
      "districtName": "연수구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 64,
      "potentialDemand2031": 62,
      "nearestParkDistanceM": 1276.8,
      "greenRatio": 0.0,
      "playgroundCount": 6
    }
  ],
  "cityBestSchool": {
    "rank": 1,
    "schoolName": "인천중산초등학교",
    "districtName": "중구",
    "casePolicyLabel": "유지·관리 대상",
    "caseStatusLabel": "접근 양호",
    "potentialDemand2029": 242,
    "potentialDemand2031": 230,
    "nearestParkDistanceM": 55.7,
    "greenRatio": 95.9,
    "playgroundCount": 1
  }
};
