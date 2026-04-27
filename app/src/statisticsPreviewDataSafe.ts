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
  currentStudentCount: number;
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
  cityTopPrioritySchoolsPlaygroundFocused: StatisticsSchoolItem[];
  cityTopPrioritySchoolsStudentFocused: StatisticsSchoolItem[];
  cityBestSchool: StatisticsSchoolItem;
};

export const cityStatisticsPreviewDataSafe: CityStatisticsData = {
  "cityName": "인천광역시",
  "summary": {
    "schoolCount": 272,
    "districtCount": 10,
    "urgentSupportCount": 10,
    "priorityReviewCount": 51,
    "totalPotentialDemand2029": 120035,
    "totalPotentialDemand2031": 108184
  },
  "districts": [
    {
      "districtName": "중구",
      "schoolCount": 16,
      "case1Count": 3,
      "case2Count": 3,
      "case3Count": 2,
      "case4Count": 8,
      "specialPolicyCount": 0,
      "priorityReviewCount": 6,
      "totalPotentialDemand2029": 9632,
      "totalPotentialDemand2031": 9629,
      "avgNearestParkDistanceM": 1259.4,
      "avgGreenRatio": 10.2,
      "avgPlaygroundCount": 1.81,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천용유초등학교",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 26,
          "potentialDemand2031": 25,
          "nearestParkDistanceM": 13471.8,
          "greenRatio": 0.0,
          "playgroundCount": 0,
          "currentStudentCount": 33
        },
        {
          "rank": 2,
          "schoolName": "인천영종초등학교금산분교장",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 43,
          "potentialDemand2031": 37,
          "nearestParkDistanceM": 1587.3,
          "greenRatio": 0.0,
          "playgroundCount": 0,
          "currentStudentCount": 47
        },
        {
          "rank": 3,
          "schoolName": "인천신선초등학교",
          "districtName": "중구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 202,
          "potentialDemand2031": 159,
          "nearestParkDistanceM": 796.8,
          "greenRatio": 0.0,
          "playgroundCount": 0,
          "currentStudentCount": 286
        },
        {
          "rank": 4,
          "schoolName": "인천연안초등학교",
          "districtName": "중구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 42,
          "potentialDemand2031": 18,
          "nearestParkDistanceM": 620.0,
          "greenRatio": 0.1,
          "playgroundCount": 0,
          "currentStudentCount": 104
        },
        {
          "rank": 5,
          "schoolName": "인천신흥초등학교",
          "districtName": "중구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 263,
          "potentialDemand2031": 230,
          "nearestParkDistanceM": 722.2,
          "greenRatio": 0.1,
          "playgroundCount": 1,
          "currentStudentCount": 312
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천중산초등학교",
        "districtName": "중구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 1567,
        "potentialDemand2031": 1549,
        "nearestParkDistanceM": 55.7,
        "greenRatio": 72.1,
        "playgroundCount": 4,
        "currentStudentCount": 1582
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
      "totalPotentialDemand2029": 2200,
      "totalPotentialDemand2031": 1903,
      "avgNearestParkDistanceM": 286.3,
      "avgGreenRatio": 1.8,
      "avgPlaygroundCount": 0.25,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천서림초등학교",
          "districtName": "동구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 303,
          "potentialDemand2031": 229,
          "nearestParkDistanceM": 728.0,
          "greenRatio": 0.0,
          "playgroundCount": 0,
          "currentStudentCount": 488
        },
        {
          "rank": 2,
          "schoolName": "인천동명초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 408,
          "potentialDemand2031": 403,
          "nearestParkDistanceM": 432.0,
          "greenRatio": 0.8,
          "playgroundCount": 0,
          "currentStudentCount": 438
        },
        {
          "rank": 3,
          "schoolName": "인천송현초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 151,
          "potentialDemand2031": 75,
          "nearestParkDistanceM": 182.0,
          "greenRatio": 0.2,
          "playgroundCount": 0,
          "currentStudentCount": 347
        },
        {
          "rank": 4,
          "schoolName": "영화초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 376,
          "potentialDemand2031": 412,
          "nearestParkDistanceM": 305.1,
          "greenRatio": 0.3,
          "playgroundCount": 0,
          "currentStudentCount": 373
        },
        {
          "rank": 5,
          "schoolName": "인천창영초등학교",
          "districtName": "동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 243,
          "potentialDemand2031": 236,
          "nearestParkDistanceM": 43.4,
          "greenRatio": 0.3,
          "playgroundCount": 0,
          "currentStudentCount": 244
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천만석초등학교",
        "districtName": "동구",
        "casePolicyLabel": "모니터링 대상",
        "caseStatusLabel": "접근 가능, 중간 수준",
        "potentialDemand2029": 103,
        "potentialDemand2031": 43,
        "nearestParkDistanceM": 110.6,
        "greenRatio": 3.1,
        "playgroundCount": 0,
        "currentStudentCount": 263
      }
    },
    {
      "districtName": "미추홀구",
      "schoolCount": 23,
      "case1Count": 1,
      "case2Count": 6,
      "case3Count": 9,
      "case4Count": 7,
      "specialPolicyCount": 0,
      "priorityReviewCount": 7,
      "totalPotentialDemand2029": 13649,
      "totalPotentialDemand2031": 12861,
      "avgNearestParkDistanceM": 233.1,
      "avgGreenRatio": 7.6,
      "avgPlaygroundCount": 0.17,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천석암초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 940,
          "potentialDemand2031": 938,
          "nearestParkDistanceM": 947.1,
          "greenRatio": 0.0,
          "playgroundCount": 0,
          "currentStudentCount": 902
        },
        {
          "rank": 2,
          "schoolName": "인천주안북초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 309,
          "potentialDemand2031": 287,
          "nearestParkDistanceM": 279.4,
          "greenRatio": 0.4,
          "playgroundCount": 0,
          "currentStudentCount": 362
        },
        {
          "rank": 3,
          "schoolName": "인천주안남초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 303,
          "potentialDemand2031": 247,
          "nearestParkDistanceM": 60.5,
          "greenRatio": 0.3,
          "playgroundCount": 0,
          "currentStudentCount": 426
        },
        {
          "rank": 4,
          "schoolName": "인천대화초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 253,
          "potentialDemand2031": 223,
          "nearestParkDistanceM": 254.6,
          "greenRatio": 0.5,
          "playgroundCount": 0,
          "currentStudentCount": 366
        },
        {
          "rank": 5,
          "schoolName": "인천경원초등학교",
          "districtName": "미추홀구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 645,
          "potentialDemand2031": 504,
          "nearestParkDistanceM": 73.2,
          "greenRatio": 0.5,
          "playgroundCount": 0,
          "currentStudentCount": 941
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천백학초등학교",
        "districtName": "미추홀구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 243,
        "potentialDemand2031": 287,
        "nearestParkDistanceM": 56.9,
        "greenRatio": 22.2,
        "playgroundCount": 0,
        "currentStudentCount": 297
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
      "totalPotentialDemand2029": 101,
      "totalPotentialDemand2031": 43,
      "avgNearestParkDistanceM": 16553.3,
      "avgGreenRatio": 0.0,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [],
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
        "playgroundCount": 0,
        "currentStudentCount": 0
      }
    },
    {
      "districtName": "부평구",
      "schoolCount": 42,
      "case1Count": 2,
      "case2Count": 9,
      "case3Count": 20,
      "case4Count": 11,
      "specialPolicyCount": 0,
      "priorityReviewCount": 11,
      "totalPotentialDemand2029": 17097,
      "totalPotentialDemand2031": 15607,
      "avgNearestParkDistanceM": 314.1,
      "avgGreenRatio": 4.6,
      "avgPlaygroundCount": 0.64,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천마장초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 393,
          "potentialDemand2031": 335,
          "nearestParkDistanceM": 839.7,
          "greenRatio": 0.0,
          "playgroundCount": 0,
          "currentStudentCount": 543
        },
        {
          "rank": 2,
          "schoolName": "인천부마초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 520,
          "potentialDemand2031": 461,
          "nearestParkDistanceM": 801.4,
          "greenRatio": 0.0,
          "playgroundCount": 11,
          "currentStudentCount": 654
        },
        {
          "rank": 3,
          "schoolName": "한일초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 339,
          "potentialDemand2031": 345,
          "nearestParkDistanceM": 67.0,
          "greenRatio": 0.8,
          "playgroundCount": 0,
          "currentStudentCount": 317
        },
        {
          "rank": 4,
          "schoolName": "인천산곡초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 504,
          "potentialDemand2031": 504,
          "nearestParkDistanceM": 200.0,
          "greenRatio": 0.3,
          "playgroundCount": 0,
          "currentStudentCount": 427
        },
        {
          "rank": 5,
          "schoolName": "인천부평동초등학교",
          "districtName": "부평구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 741,
          "potentialDemand2031": 675,
          "nearestParkDistanceM": 409.0,
          "greenRatio": 0.5,
          "playgroundCount": 0,
          "currentStudentCount": 831
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천후정초등학교",
        "districtName": "부평구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 154,
        "potentialDemand2031": 87,
        "nearestParkDistanceM": 65.9,
        "greenRatio": 9.2,
        "playgroundCount": 0,
        "currentStudentCount": 297
      }
    },
    {
      "districtName": "연수구",
      "schoolCount": 34,
      "case1Count": 1,
      "case2Count": 6,
      "case3Count": 8,
      "case4Count": 19,
      "specialPolicyCount": 0,
      "priorityReviewCount": 7,
      "totalPotentialDemand2029": 22651,
      "totalPotentialDemand2031": 21173,
      "avgNearestParkDistanceM": 228.8,
      "avgGreenRatio": 19.2,
      "avgPlaygroundCount": 1.06,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천은송초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 1606,
          "potentialDemand2031": 1652,
          "nearestParkDistanceM": 1575.0,
          "greenRatio": 0.0,
          "playgroundCount": 6,
          "currentStudentCount": 1502
        },
        {
          "rank": 2,
          "schoolName": "인천송도초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 192,
          "potentialDemand2031": 136,
          "nearestParkDistanceM": 224.0,
          "greenRatio": 0.6,
          "playgroundCount": 0,
          "currentStudentCount": 285
        },
        {
          "rank": 3,
          "schoolName": "인천연송초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 1119,
          "potentialDemand2031": 1223,
          "nearestParkDistanceM": 219.8,
          "greenRatio": 0.9,
          "playgroundCount": 0,
          "currentStudentCount": 1116
        },
        {
          "rank": 4,
          "schoolName": "인천옥련초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 576,
          "potentialDemand2031": 502,
          "nearestParkDistanceM": 242.4,
          "greenRatio": 0.7,
          "playgroundCount": 2,
          "currentStudentCount": 747
        },
        {
          "rank": 5,
          "schoolName": "인천예송초등학교",
          "districtName": "연수구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 1351,
          "potentialDemand2031": 1364,
          "nearestParkDistanceM": 0.0,
          "greenRatio": 0.7,
          "playgroundCount": 0,
          "currentStudentCount": 1185
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천신송초등학교",
        "districtName": "연수구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 299,
        "potentialDemand2031": 216,
        "nearestParkDistanceM": 0.0,
        "greenRatio": 85.2,
        "playgroundCount": 0,
        "currentStudentCount": 472
      }
    },
    {
      "districtName": "남동구",
      "schoolCount": 39,
      "case1Count": 0,
      "case2Count": 7,
      "case3Count": 18,
      "case4Count": 14,
      "specialPolicyCount": 0,
      "priorityReviewCount": 7,
      "totalPotentialDemand2029": 14134,
      "totalPotentialDemand2031": 10535,
      "avgNearestParkDistanceM": 219.9,
      "avgGreenRatio": 8.4,
      "avgPlaygroundCount": 0.64,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천정각초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 546,
          "potentialDemand2031": 321,
          "nearestParkDistanceM": 335.8,
          "greenRatio": 0.2,
          "playgroundCount": 0,
          "currentStudentCount": 950
        },
        {
          "rank": 2,
          "schoolName": "인천간석초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 417,
          "potentialDemand2031": 371,
          "nearestParkDistanceM": 185.4,
          "greenRatio": 0.6,
          "playgroundCount": 0,
          "currentStudentCount": 510
        },
        {
          "rank": 3,
          "schoolName": "인천동부초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 304,
          "potentialDemand2031": 245,
          "nearestParkDistanceM": 147.6,
          "greenRatio": 0.2,
          "playgroundCount": 1,
          "currentStudentCount": 414
        },
        {
          "rank": 4,
          "schoolName": "인천상아초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 371,
          "potentialDemand2031": 240,
          "nearestParkDistanceM": 434.0,
          "greenRatio": 0.5,
          "playgroundCount": 0,
          "currentStudentCount": 630
        },
        {
          "rank": 5,
          "schoolName": "인천석천초등학교",
          "districtName": "남동구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 768,
          "potentialDemand2031": 639,
          "nearestParkDistanceM": 180.0,
          "greenRatio": 0.5,
          "playgroundCount": 0,
          "currentStudentCount": 982
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천장아초등학교",
        "districtName": "남동구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 748,
        "potentialDemand2031": 643,
        "nearestParkDistanceM": 0.0,
        "greenRatio": 76.8,
        "playgroundCount": 0,
        "currentStudentCount": 896
      }
    },
    {
      "districtName": "계양구",
      "schoolCount": 27,
      "case1Count": 0,
      "case2Count": 8,
      "case3Count": 13,
      "case4Count": 6,
      "specialPolicyCount": 0,
      "priorityReviewCount": 8,
      "totalPotentialDemand2029": 6315,
      "totalPotentialDemand2031": 4958,
      "avgNearestParkDistanceM": 266.6,
      "avgGreenRatio": 3.1,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천명현초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 169,
          "potentialDemand2031": 130,
          "nearestParkDistanceM": 343.0,
          "greenRatio": 0.8,
          "playgroundCount": 0,
          "currentStudentCount": 223
        },
        {
          "rank": 2,
          "schoolName": "인천화전초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 441,
          "potentialDemand2031": 325,
          "nearestParkDistanceM": 400.0,
          "greenRatio": 0.1,
          "playgroundCount": 0,
          "currentStudentCount": 688
        },
        {
          "rank": 3,
          "schoolName": "인천안남초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 169,
          "potentialDemand2031": 132,
          "nearestParkDistanceM": 496.0,
          "greenRatio": 0.3,
          "playgroundCount": 0,
          "currentStudentCount": 288
        },
        {
          "rank": 4,
          "schoolName": "인천해서초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 31,
          "potentialDemand2031": 15,
          "nearestParkDistanceM": 268.2,
          "greenRatio": 0.5,
          "playgroundCount": 0,
          "currentStudentCount": 141
        },
        {
          "rank": 5,
          "schoolName": "인천부평초등학교",
          "districtName": "계양구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 152,
          "potentialDemand2031": 124,
          "nearestParkDistanceM": 144.2,
          "greenRatio": 0.6,
          "playgroundCount": 0,
          "currentStudentCount": 245
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천서운초등학교",
        "districtName": "계양구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 513,
        "potentialDemand2031": 507,
        "nearestParkDistanceM": 60.0,
        "greenRatio": 7.6,
        "playgroundCount": 0,
        "currentStudentCount": 510
      }
    },
    {
      "districtName": "서구",
      "schoolCount": 53,
      "case1Count": 2,
      "case2Count": 8,
      "case3Count": 21,
      "case4Count": 22,
      "specialPolicyCount": 0,
      "priorityReviewCount": 10,
      "totalPotentialDemand2029": 33021,
      "totalPotentialDemand2031": 30490,
      "avgNearestParkDistanceM": 245.3,
      "avgGreenRatio": 7.6,
      "avgPlaygroundCount": 0.08,
      "topPrioritySchools": [
        {
          "rank": 1,
          "schoolName": "인천가석초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 94,
          "potentialDemand2031": 43,
          "nearestParkDistanceM": 1323.0,
          "greenRatio": 0.0,
          "playgroundCount": 0,
          "currentStudentCount": 209
        },
        {
          "rank": 2,
          "schoolName": "인천봉화초등학교",
          "districtName": "서구",
          "casePolicyLabel": "즉시 개선 대상",
          "caseStatusLabel": "공원 접근 불가",
          "potentialDemand2029": 222,
          "potentialDemand2031": 183,
          "nearestParkDistanceM": 608.2,
          "greenRatio": 0.0,
          "playgroundCount": 0,
          "currentStudentCount": 298
        },
        {
          "rank": 3,
          "schoolName": "인천가현초등학교",
          "districtName": "서구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 2154,
          "potentialDemand2031": 2183,
          "nearestParkDistanceM": 240.0,
          "greenRatio": 0.0,
          "playgroundCount": 1,
          "currentStudentCount": 2044
        },
        {
          "rank": 4,
          "schoolName": "인천봉수초등학교",
          "districtName": "서구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 1714,
          "potentialDemand2031": 1797,
          "nearestParkDistanceM": 65.0,
          "greenRatio": 0.0,
          "playgroundCount": 1,
          "currentStudentCount": 1216
        },
        {
          "rank": 5,
          "schoolName": "인천검단초등학교",
          "districtName": "서구",
          "casePolicyLabel": "우선 검토 대상",
          "caseStatusLabel": "접근 가능하나 녹지 부족",
          "potentialDemand2029": 539,
          "potentialDemand2031": 470,
          "nearestParkDistanceM": 90.0,
          "greenRatio": 0.1,
          "playgroundCount": 0,
          "currentStudentCount": 680
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "인천청일초등학교",
        "districtName": "서구",
        "casePolicyLabel": "유지·관리 대상",
        "caseStatusLabel": "접근 양호",
        "potentialDemand2029": 663,
        "potentialDemand2031": 584,
        "nearestParkDistanceM": 140.0,
        "greenRatio": 82.0,
        "playgroundCount": 0,
        "currentStudentCount": 829
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
      "totalPotentialDemand2029": 1235,
      "totalPotentialDemand2031": 985,
      "avgNearestParkDistanceM": 3705.3,
      "avgGreenRatio": 3.0,
      "avgPlaygroundCount": 0.0,
      "topPrioritySchools": [],
      "bestSchool": {
        "rank": 1,
        "schoolName": "합일초등학교",
        "districtName": "강화군",
        "casePolicyLabel": "별도 정책 적용",
        "caseStatusLabel": "별도 묶음",
        "potentialDemand2029": 106,
        "potentialDemand2031": 95,
        "nearestParkDistanceM": 0.0,
        "greenRatio": 13.0,
        "playgroundCount": 0,
        "currentStudentCount": 131
      }
    }
  ],
  "cityTopPrioritySchools": [
    {
      "rank": 1,
      "schoolName": "인천용유초등학교",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 26,
      "potentialDemand2031": 25,
      "nearestParkDistanceM": 13471.8,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 33
    },
    {
      "rank": 2,
      "schoolName": "인천영종초등학교금산분교장",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 43,
      "potentialDemand2031": 37,
      "nearestParkDistanceM": 1587.3,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 47
    },
    {
      "rank": 3,
      "schoolName": "인천가석초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 94,
      "potentialDemand2031": 43,
      "nearestParkDistanceM": 1323.0,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 209
    },
    {
      "rank": 4,
      "schoolName": "인천석암초등학교",
      "districtName": "미추홀구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 940,
      "potentialDemand2031": 938,
      "nearestParkDistanceM": 947.1,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 902
    },
    {
      "rank": 5,
      "schoolName": "인천마장초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 393,
      "potentialDemand2031": 335,
      "nearestParkDistanceM": 839.7,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 543
    },
    {
      "rank": 6,
      "schoolName": "인천신선초등학교",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 202,
      "potentialDemand2031": 159,
      "nearestParkDistanceM": 796.8,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 286
    },
    {
      "rank": 7,
      "schoolName": "인천서림초등학교",
      "districtName": "동구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 303,
      "potentialDemand2031": 229,
      "nearestParkDistanceM": 728.0,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 488
    },
    {
      "rank": 8,
      "schoolName": "인천봉화초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 222,
      "potentialDemand2031": 183,
      "nearestParkDistanceM": 608.2,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 298
    },
    {
      "rank": 9,
      "schoolName": "인천은송초등학교",
      "districtName": "연수구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 1606,
      "potentialDemand2031": 1652,
      "nearestParkDistanceM": 1575.0,
      "greenRatio": 0.0,
      "playgroundCount": 6,
      "currentStudentCount": 1502
    },
    {
      "rank": 10,
      "schoolName": "인천부마초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 520,
      "potentialDemand2031": 461,
      "nearestParkDistanceM": 801.4,
      "greenRatio": 0.0,
      "playgroundCount": 11,
      "currentStudentCount": 654
    }
  ],
  "cityTopPrioritySchoolsPlaygroundFocused": [
    {
      "rank": 1,
      "schoolName": "인천석암초등학교",
      "districtName": "미추홀구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 940,
      "potentialDemand2031": 938,
      "nearestParkDistanceM": 947.1,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 902
    },
    {
      "rank": 2,
      "schoolName": "인천마장초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 393,
      "potentialDemand2031": 335,
      "nearestParkDistanceM": 839.7,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 543
    },
    {
      "rank": 3,
      "schoolName": "인천서림초등학교",
      "districtName": "동구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 303,
      "potentialDemand2031": 229,
      "nearestParkDistanceM": 728.0,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 488
    },
    {
      "rank": 4,
      "schoolName": "인천봉화초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 222,
      "potentialDemand2031": 183,
      "nearestParkDistanceM": 608.2,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 298
    },
    {
      "rank": 5,
      "schoolName": "인천신선초등학교",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 202,
      "potentialDemand2031": 159,
      "nearestParkDistanceM": 796.8,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 286
    },
    {
      "rank": 6,
      "schoolName": "인천가석초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 94,
      "potentialDemand2031": 43,
      "nearestParkDistanceM": 1323.0,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 209
    },
    {
      "rank": 7,
      "schoolName": "인천영종초등학교금산분교장",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 43,
      "potentialDemand2031": 37,
      "nearestParkDistanceM": 1587.3,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 47
    },
    {
      "rank": 8,
      "schoolName": "인천용유초등학교",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 26,
      "potentialDemand2031": 25,
      "nearestParkDistanceM": 13471.8,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 33
    },
    {
      "rank": 9,
      "schoolName": "인천은송초등학교",
      "districtName": "연수구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 1606,
      "potentialDemand2031": 1652,
      "nearestParkDistanceM": 1575.0,
      "greenRatio": 0.0,
      "playgroundCount": 6,
      "currentStudentCount": 1502
    },
    {
      "rank": 10,
      "schoolName": "인천부마초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 520,
      "potentialDemand2031": 461,
      "nearestParkDistanceM": 801.4,
      "greenRatio": 0.0,
      "playgroundCount": 11,
      "currentStudentCount": 654
    }
  ],
  "cityTopPrioritySchoolsStudentFocused": [
    {
      "rank": 1,
      "schoolName": "인천은송초등학교",
      "districtName": "연수구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 1606,
      "potentialDemand2031": 1652,
      "nearestParkDistanceM": 1575.0,
      "greenRatio": 0.0,
      "playgroundCount": 6,
      "currentStudentCount": 1502
    },
    {
      "rank": 2,
      "schoolName": "인천석암초등학교",
      "districtName": "미추홀구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 940,
      "potentialDemand2031": 938,
      "nearestParkDistanceM": 947.1,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 902
    },
    {
      "rank": 3,
      "schoolName": "인천부마초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 520,
      "potentialDemand2031": 461,
      "nearestParkDistanceM": 801.4,
      "greenRatio": 0.0,
      "playgroundCount": 11,
      "currentStudentCount": 654
    },
    {
      "rank": 4,
      "schoolName": "인천마장초등학교",
      "districtName": "부평구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 393,
      "potentialDemand2031": 335,
      "nearestParkDistanceM": 839.7,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 543
    },
    {
      "rank": 5,
      "schoolName": "인천서림초등학교",
      "districtName": "동구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 303,
      "potentialDemand2031": 229,
      "nearestParkDistanceM": 728.0,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 488
    },
    {
      "rank": 6,
      "schoolName": "인천봉화초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 222,
      "potentialDemand2031": 183,
      "nearestParkDistanceM": 608.2,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 298
    },
    {
      "rank": 7,
      "schoolName": "인천신선초등학교",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 202,
      "potentialDemand2031": 159,
      "nearestParkDistanceM": 796.8,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 286
    },
    {
      "rank": 8,
      "schoolName": "인천가석초등학교",
      "districtName": "서구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 94,
      "potentialDemand2031": 43,
      "nearestParkDistanceM": 1323.0,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 209
    },
    {
      "rank": 9,
      "schoolName": "인천영종초등학교금산분교장",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 43,
      "potentialDemand2031": 37,
      "nearestParkDistanceM": 1587.3,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 47
    },
    {
      "rank": 10,
      "schoolName": "인천용유초등학교",
      "districtName": "중구",
      "casePolicyLabel": "즉시 개선 대상",
      "caseStatusLabel": "공원 접근 불가",
      "potentialDemand2029": 26,
      "potentialDemand2031": 25,
      "nearestParkDistanceM": 13471.8,
      "greenRatio": 0.0,
      "playgroundCount": 0,
      "currentStudentCount": 33
    }
  ],
  "cityBestSchool": {
    "rank": 1,
    "schoolName": "인천신송초등학교",
    "districtName": "연수구",
    "casePolicyLabel": "유지·관리 대상",
    "caseStatusLabel": "접근 양호",
    "potentialDemand2029": 299,
    "potentialDemand2031": 216,
    "nearestParkDistanceM": 0.0,
    "greenRatio": 85.2,
    "playgroundCount": 0,
    "currentStudentCount": 472
  }
};
