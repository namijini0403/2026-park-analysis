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
    "urgentSupportCount": 25,
    "priorityReviewCount": 73,
    "totalPotentialDemand2029": 122318,
    "totalPotentialDemand2031": 122858
  },
  "districts": [
    {
      "districtName": "중구",
      "schoolCount": 16,
      "case1Count": 6,
      "case2Count": 3,
      "case3Count": 1,
      "case4Count": 5,
      "specialPolicyCount": 1,
      "priorityReviewCount": 9,
      "totalPotentialDemand2029": 3782,
      "totalPotentialDemand2031": 3625,
      "avgNearestParkDistanceM": 1237.6,
      "avgGreenRatio": 7.7,
      "avgPlaygroundCount": 3.12,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천별빛초등학교",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 496,
          "potentialDemand2031": 473,
          "nearestParkDistanceM": 544.0,
          "greenRatio": 0.0,
          "playgroundCount": 5
        },
        {
          "rank": 2,
          "schoolName": "인천신광초등학교",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 443,
          "potentialDemand2031": 429,
          "nearestParkDistanceM": 533.7,
          "greenRatio": 0.0,
          "playgroundCount": 7
        },
        {
          "rank": 3,
          "schoolName": "인천신선초등학교",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 190,
          "potentialDemand2031": 184,
          "nearestParkDistanceM": 796.8,
          "greenRatio": 0.0,
          "playgroundCount": 1
        },
        {
          "rank": 4,
          "schoolName": "인천신흥초등학교",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 225,
          "potentialDemand2031": 218,
          "nearestParkDistanceM": 722.2,
          "greenRatio": 0.0,
          "playgroundCount": 2
        },
        {
          "rank": 5,
          "schoolName": "인천용유초등학교",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 5,
          "potentialDemand2031": 5,
          "nearestParkDistanceM": 13471.8,
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
        "potentialDemand2029": 471,
        "potentialDemand2031": 450,
        "nearestParkDistanceM": 55.7,
        "greenRatio": 82.8,
        "playgroundCount": 2
      }
    },
    {
      "districtName": "동구",
      "schoolCount": 8,
      "case1Count": 1,
      "case2Count": 5,
      "case3Count": 1,
      "case4Count": 1,
      "specialPolicyCount": 0,
      "priorityReviewCount": 6,
      "totalPotentialDemand2029": 3762,
      "totalPotentialDemand2031": 3827,
      "avgNearestParkDistanceM": 286.3,
      "avgGreenRatio": 0.8,
      "avgPlaygroundCount": 0.25,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천서림초등학교",
          "districtName": "동구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 555,
          "potentialDemand2031": 570,
          "nearestParkDistanceM": 728.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천송현초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 555,
          "potentialDemand2031": 570,
          "nearestParkDistanceM": 182.0,
          "greenRatio": 0.2,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천동명초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 548,
          "potentialDemand2031": 564,
          "nearestParkDistanceM": 432.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천서흥초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 518,
          "potentialDemand2031": 505,
          "nearestParkDistanceM": 208.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천창영초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 338,
          "potentialDemand2031": 348,
          "nearestParkDistanceM": 43.4,
          "greenRatio": 0.3,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천만석초등학교",
        "districtName": "동구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 244,
        "potentialDemand2031": 237,
        "nearestParkDistanceM": 110.6,
        "greenRatio": 4.4,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "미추홀구",
      "schoolCount": 23,
      "case1Count": 3,
      "case2Count": 6,
      "case3Count": 9,
      "case4Count": 5,
      "specialPolicyCount": 0,
      "priorityReviewCount": 9,
      "totalPotentialDemand2029": 14028,
      "totalPotentialDemand2031": 14474,
      "avgNearestParkDistanceM": 265.0,
      "avgGreenRatio": 2.8,
      "avgPlaygroundCount": 0.13,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천석암초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 824,
          "potentialDemand2031": 867,
          "nearestParkDistanceM": 947.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천도화초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 323,
          "potentialDemand2031": 315,
          "nearestParkDistanceM": 605.3,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천학익초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 147,
          "potentialDemand2031": 143,
          "nearestParkDistanceM": 784.3,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천대화초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 1050,
          "potentialDemand2031": 1105,
          "nearestParkDistanceM": 254.6,
          "greenRatio": 0.5,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천주안남초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 1049,
          "potentialDemand2031": 1104,
          "nearestParkDistanceM": 60.5,
          "greenRatio": 0.3,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천연학초등학교",
        "districtName": "미추홀구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 764,
        "potentialDemand2031": 804,
        "nearestParkDistanceM": 121.4,
        "greenRatio": 13.0,
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
      "totalPotentialDemand2029": 20,
      "totalPotentialDemand2031": 10,
      "avgNearestParkDistanceM": 16553.3,
      "avgGreenRatio": 0.0,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "연평초등학교",
          "districtName": "옹진군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 2,
          "potentialDemand2031": 1,
          "nearestParkDistanceM": 16479.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "대청초등학교",
          "districtName": "옹진군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 2,
          "potentialDemand2031": 1,
          "nearestParkDistanceM": 16479.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "영흥초등학교",
          "districtName": "옹진군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 2,
          "potentialDemand2031": 1,
          "nearestParkDistanceM": 19637.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "덕적초등학교",
          "districtName": "옹진군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 2,
          "potentialDemand2031": 1,
          "nearestParkDistanceM": 18983.5,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "북포초등학교",
          "districtName": "옹진군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 2,
          "potentialDemand2031": 1,
          "nearestParkDistanceM": 16479.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천공항초등학교신도분교장",
        "districtName": "옹진군",
        "casePolicyLabel": "별도 정책 적용",
        "caseStatusLabel": "별도 묶음",
        "potentialDemand2029": 2,
        "potentialDemand2031": 1,
        "nearestParkDistanceM": 6831.7,
        "greenRatio": 0.0,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "부평구",
      "schoolCount": 42,
      "case1Count": 4,
      "case2Count": 12,
      "case3Count": 11,
      "case4Count": 15,
      "specialPolicyCount": 0,
      "priorityReviewCount": 16,
      "totalPotentialDemand2029": 30735,
      "totalPotentialDemand2031": 31800,
      "avgNearestParkDistanceM": 314.1,
      "avgGreenRatio": 3.0,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천마장초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 802,
          "potentialDemand2031": 782,
          "nearestParkDistanceM": 839.7,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천부마초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 870,
          "potentialDemand2031": 934,
          "nearestParkDistanceM": 801.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천부원초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 873,
          "potentialDemand2031": 938,
          "nearestParkDistanceM": 752.2,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천미산초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 530,
          "potentialDemand2031": 517,
          "nearestParkDistanceM": 1143.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천부개초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 1334,
          "potentialDemand2031": 1432,
          "nearestParkDistanceM": 305.9,
          "greenRatio": 0.3,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천후정초등학교",
        "districtName": "부평구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 271,
        "potentialDemand2031": 264,
        "nearestParkDistanceM": 65.9,
        "greenRatio": 9.9,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "연수구",
      "schoolCount": 34,
      "case1Count": 5,
      "case2Count": 14,
      "case3Count": 1,
      "case4Count": 14,
      "specialPolicyCount": 0,
      "priorityReviewCount": 19,
      "totalPotentialDemand2029": 14564,
      "totalPotentialDemand2031": 14226,
      "avgNearestParkDistanceM": 281.7,
      "avgGreenRatio": 11.6,
      "avgPlaygroundCount": 0.47,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천송담초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 491,
          "potentialDemand2031": 478,
          "nearestParkDistanceM": 746.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천은송초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 276,
          "potentialDemand2031": 268,
          "nearestParkDistanceM": 1575.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천명선초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 99,
          "potentialDemand2031": 97,
          "nearestParkDistanceM": 917.9,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천송빛초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 99,
          "potentialDemand2031": 97,
          "nearestParkDistanceM": 716.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천연수초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 99,
          "potentialDemand2031": 97,
          "nearestParkDistanceM": 714.9,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천청학초등학교",
        "districtName": "연수구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 393,
        "potentialDemand2031": 383,
        "nearestParkDistanceM": 131.3,
        "greenRatio": 28.2,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "남동구",
      "schoolCount": 39,
      "case1Count": 1,
      "case2Count": 6,
      "case3Count": 19,
      "case4Count": 13,
      "specialPolicyCount": 0,
      "priorityReviewCount": 7,
      "totalPotentialDemand2029": 22217,
      "totalPotentialDemand2031": 22159,
      "avgNearestParkDistanceM": 219.9,
      "avgGreenRatio": 6.7,
      "avgPlaygroundCount": 1.38,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천장수초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 149,
          "potentialDemand2031": 145,
          "nearestParkDistanceM": 602.6,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천동부초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 1198,
          "potentialDemand2031": 1255,
          "nearestParkDistanceM": 147.6,
          "greenRatio": 0.2,
          "playgroundCount": 2
        },
        {
          "rank": 3,
          "schoolName": "인천석천초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 733,
          "potentialDemand2031": 768,
          "nearestParkDistanceM": 180.0,
          "greenRatio": 0.4,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천만수북초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 592,
          "potentialDemand2031": 621,
          "nearestParkDistanceM": 384.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천상아초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 536,
          "potentialDemand2031": 522,
          "nearestParkDistanceM": 434.0,
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
        "potentialDemand2029": 672,
        "potentialDemand2031": 655,
        "nearestParkDistanceM": 180.7,
        "greenRatio": 73.0,
        "playgroundCount": 1
      }
    },
    {
      "districtName": "계양구",
      "schoolCount": 27,
      "case1Count": 0,
      "case2Count": 11,
      "case3Count": 11,
      "case4Count": 4,
      "specialPolicyCount": 1,
      "priorityReviewCount": 11,
      "totalPotentialDemand2029": 11864,
      "totalPotentialDemand2031": 11839,
      "avgNearestParkDistanceM": 266.6,
      "avgGreenRatio": 1.9,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천작동초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 885,
          "potentialDemand2031": 902,
          "nearestParkDistanceM": 437.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천화전초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 814,
          "potentialDemand2031": 831,
          "nearestParkDistanceM": 400.0,
          "greenRatio": 0.1,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천부현초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 765,
          "potentialDemand2031": 745,
          "nearestParkDistanceM": 327.0,
          "greenRatio": 0.6,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천부평초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 579,
          "potentialDemand2031": 591,
          "nearestParkDistanceM": 144.2,
          "greenRatio": 0.5,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천병방초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 539,
          "potentialDemand2031": 525,
          "nearestParkDistanceM": 291.1,
          "greenRatio": 0.5,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천신대초등학교",
        "districtName": "계양구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 220,
        "potentialDemand2031": 215,
        "nearestParkDistanceM": 148.0,
        "greenRatio": 9.6,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "서구",
      "schoolCount": 53,
      "case1Count": 5,
      "case2Count": 16,
      "case3Count": 18,
      "case4Count": 14,
      "specialPolicyCount": 0,
      "priorityReviewCount": 21,
      "totalPotentialDemand2029": 21153,
      "totalPotentialDemand2031": 20718,
      "avgNearestParkDistanceM": 238.1,
      "avgGreenRatio": 4.2,
      "avgPlaygroundCount": 0.06,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천신현초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 813,
          "potentialDemand2031": 822,
          "nearestParkDistanceM": 602.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천가정초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 276,
          "potentialDemand2031": 268,
          "nearestParkDistanceM": 663.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천봉화초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 276,
          "potentialDemand2031": 268,
          "nearestParkDistanceM": 608.2,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천가석초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 109,
          "potentialDemand2031": 106,
          "nearestParkDistanceM": 1323.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천천마초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 109,
          "potentialDemand2031": 106,
          "nearestParkDistanceM": 602.7,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천청호초등학교",
        "districtName": "서구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 700,
        "potentialDemand2031": 682,
        "nearestParkDistanceM": 156.0,
        "greenRatio": 23.4,
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
      "totalPotentialDemand2029": 193,
      "totalPotentialDemand2031": 180,
      "avgNearestParkDistanceM": 3705.3,
      "avgGreenRatio": 0.6,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "강화초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 65,
          "potentialDemand2031": 59,
          "nearestParkDistanceM": 0.0,
          "greenRatio": 0.1,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "합일초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 65,
          "potentialDemand2031": 59,
          "nearestParkDistanceM": 0.0,
          "greenRatio": 12.7,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "길상초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 12,
          "potentialDemand2031": 11,
          "nearestParkDistanceM": 4242.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "양도초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 3,
          "potentialDemand2031": 3,
          "nearestParkDistanceM": 4242.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "조산초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 3,
          "potentialDemand2031": 3,
          "nearestParkDistanceM": 4242.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "갑룡초등학교",
        "districtName": "강화군",
        "casePolicyLabel": "별도 정책 적용",
        "caseStatusLabel": "별도 묶음",
        "potentialDemand2029": 3,
        "potentialDemand2031": 3,
        "nearestParkDistanceM": 285.0,
        "greenRatio": 0.0,
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
      "potentialDemand2029": 824,
      "potentialDemand2031": 867,
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
      "potentialDemand2029": 802,
      "potentialDemand2031": 782,
      "nearestParkDistanceM": 839.7,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 3,
      "schoolName": "인천부마초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 870,
      "potentialDemand2031": 934,
      "nearestParkDistanceM": 801.4,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 4,
      "schoolName": "인천부원초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 873,
      "potentialDemand2031": 938,
      "nearestParkDistanceM": 752.2,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 5,
      "schoolName": "인천신현초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 813,
      "potentialDemand2031": 822,
      "nearestParkDistanceM": 602.1,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 6,
      "schoolName": "인천미산초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 530,
      "potentialDemand2031": 517,
      "nearestParkDistanceM": 1143.0,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 7,
      "schoolName": "인천송담초등학교",
      "districtName": "연수구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 491,
      "potentialDemand2031": 478,
      "nearestParkDistanceM": 746.1,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 8,
      "schoolName": "인천서림초등학교",
      "districtName": "동구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 555,
      "potentialDemand2031": 570,
      "nearestParkDistanceM": 728.0,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 9,
      "schoolName": "인천별빛초등학교",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 496,
      "potentialDemand2031": 473,
      "nearestParkDistanceM": 544.0,
      "greenRatio": 0.0,
      "playgroundCount": 5
    },
    {
      "rank": 10,
      "schoolName": "인천신광초등학교",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 443,
      "potentialDemand2031": 429,
      "nearestParkDistanceM": 533.7,
      "greenRatio": 0.0,
      "playgroundCount": 7
    }
  ],
  "cityBestSchool": {
    "rank": 1,
    "schoolName": "인천중산초등학교",
    "districtName": "중구",
    "casePolicyLabel": "유지·관리 대상",
    "caseStatusLabel": "접근 양호",
    "potentialDemand2029": 471,
    "potentialDemand2031": 450,
    "nearestParkDistanceM": 55.7,
    "greenRatio": 82.8,
    "playgroundCount": 2
  }
};
