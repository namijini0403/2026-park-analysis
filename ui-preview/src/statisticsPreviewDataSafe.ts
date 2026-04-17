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
    "urgentSupportCount": 18,
    "priorityReviewCount": 104,
    "totalPotentialDemand2029": 75780,
    "totalPotentialDemand2031": 76145
  },
  "districts": [
    {
      "districtName": "중구",
      "schoolCount": 16,
      "case1Count": 2,
      "case2Count": 4,
      "case3Count": 3,
      "case4Count": 6,
      "specialPolicyCount": 1,
      "priorityReviewCount": 6,
      "totalPotentialDemand2029": 2275,
      "totalPotentialDemand2031": 2175,
      "avgNearestParkDistanceM": 516.1,
      "avgGreenRatio": 10.4,
      "avgPlaygroundCount": 1.19,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천신선초등학교",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 122,
          "potentialDemand2031": 118,
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
          "potentialDemand2029": 39,
          "potentialDemand2031": 37,
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
          "potentialDemand2029": 138,
          "potentialDemand2031": 133,
          "nearestParkDistanceM": 121.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천삼목초등학교",
          "districtName": "중구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 53,
          "potentialDemand2031": 50,
          "nearestParkDistanceM": 303.7,
          "greenRatio": 1.6,
          "playgroundCount": 3
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천하늘초등학교",
        "districtName": "중구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 215,
        "potentialDemand2031": 205,
        "nearestParkDistanceM": 124.0,
        "greenRatio": 75.5,
        "playgroundCount": 1
      }
    },
    {
      "districtName": "동구",
      "schoolCount": 8,
      "case1Count": 1,
      "case2Count": 6,
      "case3Count": 1,
      "case4Count": 0,
      "specialPolicyCount": 0,
      "priorityReviewCount": 7,
      "totalPotentialDemand2029": 2635,
      "totalPotentialDemand2031": 2705,
      "avgNearestParkDistanceM": 359.9,
      "avgGreenRatio": 2.4,
      "avgPlaygroundCount": 0.25,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천서림초등학교",
          "districtName": "동구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 404,
          "potentialDemand2031": 419,
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
          "potentialDemand2029": 425,
          "potentialDemand2031": 442,
          "nearestParkDistanceM": 650.3,
          "greenRatio": 5.1,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천송현초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 369,
          "potentialDemand2031": 384,
          "nearestParkDistanceM": 182.0,
          "greenRatio": 0.2,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천서흥초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 350,
          "potentialDemand2031": 341,
          "nearestParkDistanceM": 505.5,
          "greenRatio": 5.2,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "영화초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 229,
          "potentialDemand2031": 238,
          "nearestParkDistanceM": 305.1,
          "greenRatio": 0.5,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천만석초등학교",
        "districtName": "동구",
        "casePolicyLabel": "우선 검토 대상",
        "caseStatusLabel": "접근 가능하나 녹지 부족",
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
      "case1Count": 2,
      "case2Count": 12,
      "case3Count": 5,
      "case4Count": 4,
      "specialPolicyCount": 0,
      "priorityReviewCount": 14,
      "totalPotentialDemand2029": 9160,
      "totalPotentialDemand2031": 9494,
      "avgNearestParkDistanceM": 368.8,
      "avgGreenRatio": 7.7,
      "avgPlaygroundCount": 0.04,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천석암초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 555,
          "potentialDemand2031": 586,
          "nearestParkDistanceM": 947.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천학익초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 37,
          "potentialDemand2031": 37,
          "nearestParkDistanceM": 784.3,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
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
          "rank": 4,
          "schoolName": "인천주안남초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 657,
          "potentialDemand2031": 693,
          "nearestParkDistanceM": 60.5,
          "greenRatio": 0.4,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천남부초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 656,
          "potentialDemand2031": 692,
          "nearestParkDistanceM": 305.0,
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
        "potentialDemand2029": 394,
        "potentialDemand2031": 415,
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
      "case2Count": 19,
      "case3Count": 11,
      "case4Count": 8,
      "specialPolicyCount": 0,
      "priorityReviewCount": 23,
      "totalPotentialDemand2029": 18616,
      "totalPotentialDemand2031": 19238,
      "avgNearestParkDistanceM": 427.2,
      "avgGreenRatio": 5.5,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천마장초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 531,
          "potentialDemand2031": 518,
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
          "potentialDemand2029": 583,
          "potentialDemand2031": 624,
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
          "potentialDemand2029": 572,
          "potentialDemand2031": 612,
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
          "potentialDemand2029": 186,
          "potentialDemand2031": 181,
          "nearestParkDistanceM": 1143.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천동수초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 963,
          "potentialDemand2031": 1031,
          "nearestParkDistanceM": 536.8,
          "greenRatio": 1.4,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천진산초등학교",
        "districtName": "부평구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 74,
        "potentialDemand2031": 72,
        "nearestParkDistanceM": 152.0,
        "greenRatio": 14.0,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "연수구",
      "schoolCount": 34,
      "case1Count": 4,
      "case2Count": 15,
      "case3Count": 4,
      "case4Count": 11,
      "specialPolicyCount": 0,
      "priorityReviewCount": 19,
      "totalPotentialDemand2029": 8851,
      "totalPotentialDemand2031": 8656,
      "avgNearestParkDistanceM": 454.4,
      "avgGreenRatio": 18.3,
      "avgPlaygroundCount": 0.12,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천은송초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 330,
          "potentialDemand2031": 321,
          "nearestParkDistanceM": 1575.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천송담초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 156,
          "potentialDemand2031": 152,
          "nearestParkDistanceM": 746.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천송빛초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 68,
          "potentialDemand2031": 67,
          "nearestParkDistanceM": 1276.8,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천명선초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 68,
          "potentialDemand2031": 67,
          "nearestParkDistanceM": 917.9,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천옥련초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 762,
          "potentialDemand2031": 742,
          "nearestParkDistanceM": 242.4,
          "greenRatio": 0.6,
          "playgroundCount": 2
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천신송초등학교",
        "districtName": "연수구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 115,
        "potentialDemand2031": 112,
        "nearestParkDistanceM": 0.0,
        "greenRatio": 100.0,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "남동구",
      "schoolCount": 39,
      "case1Count": 0,
      "case2Count": 14,
      "case3Count": 11,
      "case4Count": 14,
      "specialPolicyCount": 0,
      "priorityReviewCount": 14,
      "totalPotentialDemand2029": 13116,
      "totalPotentialDemand2031": 13042,
      "avgNearestParkDistanceM": 244.4,
      "avgGreenRatio": 12.7,
      "avgPlaygroundCount": 0.59,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천인동초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 766,
          "potentialDemand2031": 746,
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
          "potentialDemand2029": 662,
          "potentialDemand2031": 689,
          "nearestParkDistanceM": 147.6,
          "greenRatio": 0.4,
          "playgroundCount": 1
        },
        {
          "rank": 3,
          "schoolName": "인천성리초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 597,
          "potentialDemand2031": 621,
          "nearestParkDistanceM": 300.9,
          "greenRatio": 1.4,
          "playgroundCount": 18
        },
        {
          "rank": 4,
          "schoolName": "인천간석초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 567,
          "potentialDemand2031": 552,
          "nearestParkDistanceM": 185.4,
          "greenRatio": 1.1,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "상인천초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 567,
          "potentialDemand2031": 591,
          "nearestParkDistanceM": 473.0,
          "greenRatio": 0.1,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천송천초등학교",
        "districtName": "남동구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 350,
        "potentialDemand2031": 341,
        "nearestParkDistanceM": 180.7,
        "greenRatio": 75.1,
        "playgroundCount": 1
      }
    },
    {
      "districtName": "계양구",
      "schoolCount": 27,
      "case1Count": 0,
      "case2Count": 14,
      "case3Count": 10,
      "case4Count": 2,
      "specialPolicyCount": 1,
      "priorityReviewCount": 14,
      "totalPotentialDemand2029": 7620,
      "totalPotentialDemand2031": 7627,
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
          "potentialDemand2029": 641,
          "potentialDemand2031": 656,
          "nearestParkDistanceM": 425.8,
          "greenRatio": 0.1,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천명현초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 635,
          "potentialDemand2031": 650,
          "nearestParkDistanceM": 368.6,
          "greenRatio": 1.3,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천안남초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 588,
          "potentialDemand2031": 572,
          "nearestParkDistanceM": 436.0,
          "greenRatio": 0.3,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천작동초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 553,
          "potentialDemand2031": 566,
          "nearestParkDistanceM": 353.7,
          "greenRatio": 1.2,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천부평초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 449,
          "potentialDemand2031": 459,
          "nearestParkDistanceM": 144.2,
          "greenRatio": 0.6,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "경인교육대학교부설초등학교",
        "districtName": "계양구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 167,
        "potentialDemand2031": 170,
        "nearestParkDistanceM": 53.9,
        "greenRatio": 7.4,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "서구",
      "schoolCount": 53,
      "case1Count": 5,
      "case2Count": 20,
      "case3Count": 14,
      "case4Count": 14,
      "specialPolicyCount": 0,
      "priorityReviewCount": 25,
      "totalPotentialDemand2029": 13170,
      "totalPotentialDemand2031": 12900,
      "avgNearestParkDistanceM": 422.9,
      "avgGreenRatio": 7.5,
      "avgPlaygroundCount": 0.08,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천석남초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 153,
          "potentialDemand2031": 154,
          "nearestParkDistanceM": 1010.3,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "인천봉화초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 136,
          "potentialDemand2031": 132,
          "nearestParkDistanceM": 608.2,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "인천가석초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 55,
          "potentialDemand2031": 54,
          "nearestParkDistanceM": 1323.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "인천가정초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 55,
          "potentialDemand2031": 54,
          "nearestParkDistanceM": 663.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "인천천마초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 55,
          "potentialDemand2031": 54,
          "nearestParkDistanceM": 602.7,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천심곡초등학교",
        "districtName": "서구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 148,
        "potentialDemand2031": 144,
        "nearestParkDistanceM": 163.0,
        "greenRatio": 15.7,
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
      "totalPotentialDemand2029": 337,
      "totalPotentialDemand2031": 308,
      "avgNearestParkDistanceM": 2748.5,
      "avgGreenRatio": 2.7,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "합일초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 169,
          "potentialDemand2031": 155,
          "nearestParkDistanceM": 0.0,
          "greenRatio": 13.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "강화초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 119,
          "potentialDemand2031": 109,
          "nearestParkDistanceM": 0.0,
          "greenRatio": 2.3,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "갑룡초등학교",
          "districtName": "강화군",
          "casePolicyLabel": "별도 정책 적용",
          "caseStatusLabel": "별도 묶음",
          "potentialDemand2029": 37,
          "potentialDemand2031": 34,
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
          "potentialDemand2029": 6,
          "potentialDemand2031": 5,
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
          "potentialDemand2029": 6,
          "potentialDemand2031": 5,
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
        "potentialDemand2029": 169,
        "potentialDemand2031": 155,
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
      "potentialDemand2029": 555,
      "potentialDemand2031": 586,
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
      "potentialDemand2029": 531,
      "potentialDemand2031": 518,
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
      "potentialDemand2029": 583,
      "potentialDemand2031": 624,
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
      "potentialDemand2029": 572,
      "potentialDemand2031": 612,
      "nearestParkDistanceM": 752.2,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 5,
      "schoolName": "인천은송초등학교",
      "districtName": "연수구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 330,
      "potentialDemand2031": 321,
      "nearestParkDistanceM": 1575.0,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 6,
      "schoolName": "인천서림초등학교",
      "districtName": "동구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 404,
      "potentialDemand2031": 419,
      "nearestParkDistanceM": 728.0,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 7,
      "schoolName": "인천미산초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 186,
      "potentialDemand2031": 181,
      "nearestParkDistanceM": 1143.0,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 8,
      "schoolName": "인천석남초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 153,
      "potentialDemand2031": 154,
      "nearestParkDistanceM": 1010.3,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 9,
      "schoolName": "인천송담초등학교",
      "districtName": "연수구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 156,
      "potentialDemand2031": 152,
      "nearestParkDistanceM": 746.1,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 10,
      "schoolName": "인천봉화초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 136,
      "potentialDemand2031": 132,
      "nearestParkDistanceM": 608.2,
      "greenRatio": 0.0,
      "playgroundCount": 0
    }
  ],
  "cityBestSchool": {
    "rank": 1,
    "schoolName": "인천하늘초등학교",
    "districtName": "중구",
    "casePolicyLabel": "유지·관리 대상",
    "caseStatusLabel": "접근 양호",
    "potentialDemand2029": 215,
    "potentialDemand2031": 205,
    "nearestParkDistanceM": 124.0,
    "greenRatio": 75.5,
    "playgroundCount": 1
  }
};
