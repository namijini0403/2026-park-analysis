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
  "cityName": "\uc778\ucc9c\uad11\uc5ed\uc2dc",
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
      "districtName": "\uc911\uad6c",
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
          "schoolName": "\uc778\ucc9c\ubcc4\ube5b\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc911\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 496,
          "potentialDemand2031": 473,
          "nearestParkDistanceM": 544.0,
          "greenRatio": 0.0,
          "playgroundCount": 5
        },
        {
          "rank": 2,
          "schoolName": "\uc778\ucc9c\uc2e0\uad11\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc911\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 443,
          "potentialDemand2031": 429,
          "nearestParkDistanceM": 533.7,
          "greenRatio": 0.0,
          "playgroundCount": 7
        },
        {
          "rank": 3,
          "schoolName": "\uc778\ucc9c\uc2e0\uc120\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc911\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 190,
          "potentialDemand2031": 184,
          "nearestParkDistanceM": 796.8,
          "greenRatio": 0.0,
          "playgroundCount": 1
        },
        {
          "rank": 4,
          "schoolName": "\uc778\ucc9c\uc2e0\ud765\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc911\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 225,
          "potentialDemand2031": 218,
          "nearestParkDistanceM": 722.2,
          "greenRatio": 0.0,
          "playgroundCount": 2
        },
        {
          "rank": 5,
          "schoolName": "\uc778\ucc9c\uc6a9\uc720\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc911\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 5,
          "potentialDemand2031": 5,
          "nearestParkDistanceM": 13471.8,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "\uc778\ucc9c\uc911\uc0b0\ucd08\ub4f1\ud559\uad50",
        "districtName": "\uc911\uad6c",
        "casePolicyLabel": "\uc720\uc9c0\u00b7\uad00\ub9ac \ub300\uc0c1",
        "caseStatusLabel": "\uc811\uadfc \uc591\ud638",
        "potentialDemand2029": 471,
        "potentialDemand2031": 450,
        "nearestParkDistanceM": 55.7,
        "greenRatio": 82.8,
        "playgroundCount": 2
      }
    },
    {
      "districtName": "\ub3d9\uad6c",
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
          "schoolName": "\uc778\ucc9c\uc11c\ub9bc\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ub3d9\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 555,
          "potentialDemand2031": 570,
          "nearestParkDistanceM": 728.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "\uc778\ucc9c\uc1a1\ud604\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ub3d9\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 555,
          "potentialDemand2031": 570,
          "nearestParkDistanceM": 182.0,
          "greenRatio": 0.2,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "\uc778\ucc9c\ub3d9\uba85\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ub3d9\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 548,
          "potentialDemand2031": 564,
          "nearestParkDistanceM": 432.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "\uc778\ucc9c\uc11c\ud765\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ub3d9\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 518,
          "potentialDemand2031": 505,
          "nearestParkDistanceM": 208.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "\uc778\ucc9c\ucc3d\uc601\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ub3d9\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 338,
          "potentialDemand2031": 348,
          "nearestParkDistanceM": 43.4,
          "greenRatio": 0.3,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "\uc778\ucc9c\ub9cc\uc11d\ucd08\ub4f1\ud559\uad50",
        "districtName": "\ub3d9\uad6c",
        "casePolicyLabel": "\uc720\uc9c0\u00b7\uad00\ub9ac \ub300\uc0c1",
        "caseStatusLabel": "\uc811\uadfc \uc591\ud638",
        "potentialDemand2029": 244,
        "potentialDemand2031": 237,
        "nearestParkDistanceM": 110.6,
        "greenRatio": 4.4,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "\ubbf8\ucd94\ud640\uad6c",
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
          "schoolName": "\uc778\ucc9c\uc11d\uc554\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ubbf8\ucd94\ud640\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 824,
          "potentialDemand2031": 867,
          "nearestParkDistanceM": 947.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "\uc778\ucc9c\ub3c4\ud654\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ubbf8\ucd94\ud640\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 323,
          "potentialDemand2031": 315,
          "nearestParkDistanceM": 605.3,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "\uc778\ucc9c\ud559\uc775\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ubbf8\ucd94\ud640\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 147,
          "potentialDemand2031": 143,
          "nearestParkDistanceM": 784.3,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "\uc778\ucc9c\ub300\ud654\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ubbf8\ucd94\ud640\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 1050,
          "potentialDemand2031": 1105,
          "nearestParkDistanceM": 254.6,
          "greenRatio": 0.5,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "\uc778\ucc9c\uc8fc\uc548\ub0a8\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ubbf8\ucd94\ud640\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 1049,
          "potentialDemand2031": 1104,
          "nearestParkDistanceM": 60.5,
          "greenRatio": 0.3,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "\uc778\ucc9c\uc5f0\ud559\ucd08\ub4f1\ud559\uad50",
        "districtName": "\ubbf8\ucd94\ud640\uad6c",
        "casePolicyLabel": "\uc720\uc9c0\u00b7\uad00\ub9ac \ub300\uc0c1",
        "caseStatusLabel": "\uc811\uadfc \uc591\ud638",
        "potentialDemand2029": 764,
        "potentialDemand2031": 804,
        "nearestParkDistanceM": 121.4,
        "greenRatio": 13.0,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "\uc639\uc9c4\uad70",
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
          "schoolName": "\uc5f0\ud3c9\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc639\uc9c4\uad70",
          "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
          "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
          "potentialDemand2029": 2,
          "potentialDemand2031": 1,
          "nearestParkDistanceM": 16479.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "\ub300\uccad\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc639\uc9c4\uad70",
          "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
          "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
          "potentialDemand2029": 2,
          "potentialDemand2031": 1,
          "nearestParkDistanceM": 16479.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "\uc601\ud765\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc639\uc9c4\uad70",
          "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
          "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
          "potentialDemand2029": 2,
          "potentialDemand2031": 1,
          "nearestParkDistanceM": 19637.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "\ub355\uc801\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc639\uc9c4\uad70",
          "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
          "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
          "potentialDemand2029": 2,
          "potentialDemand2031": 1,
          "nearestParkDistanceM": 18983.5,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "\ubd81\ud3ec\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc639\uc9c4\uad70",
          "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
          "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
          "potentialDemand2029": 2,
          "potentialDemand2031": 1,
          "nearestParkDistanceM": 16479.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "\uc778\ucc9c\uacf5\ud56d\ucd08\ub4f1\ud559\uad50\uc2e0\ub3c4\ubd84\uad50\uc7a5",
        "districtName": "\uc639\uc9c4\uad70",
        "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
        "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
        "potentialDemand2029": 2,
        "potentialDemand2031": 1,
        "nearestParkDistanceM": 6831.7,
        "greenRatio": 0.0,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "\ubd80\ud3c9\uad6c",
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
          "schoolName": "\uc778\ucc9c\ub9c8\uc7a5\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ubd80\ud3c9\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 802,
          "potentialDemand2031": 782,
          "nearestParkDistanceM": 839.7,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "\uc778\ucc9c\ubd80\ub9c8\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ubd80\ud3c9\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 870,
          "potentialDemand2031": 934,
          "nearestParkDistanceM": 801.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "\uc778\ucc9c\ubd80\uc6d0\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ubd80\ud3c9\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 873,
          "potentialDemand2031": 938,
          "nearestParkDistanceM": 752.2,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "\uc778\ucc9c\ubbf8\uc0b0\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ubd80\ud3c9\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 530,
          "potentialDemand2031": 517,
          "nearestParkDistanceM": 1143.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "\uc778\ucc9c\ubd80\uac1c\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ubd80\ud3c9\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 1334,
          "potentialDemand2031": 1432,
          "nearestParkDistanceM": 305.9,
          "greenRatio": 0.3,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "\uc778\ucc9c\ubd80\ub0b4\ucd08\ub4f1\ud559\uad50",
        "districtName": "\ubd80\ud3c9\uad6c",
        "casePolicyLabel": "\uc720\uc9c0\u00b7\uad00\ub9ac \ub300\uc0c1",
        "caseStatusLabel": "\uc811\uadfc \uc591\ud638",
        "potentialDemand2029": 500,
        "potentialDemand2031": 488,
        "nearestParkDistanceM": 263.6,
        "greenRatio": 14.0,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "\uc5f0\uc218\uad6c",
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
          "schoolName": "\uc778\ucc9c\uc1a1\ub2f4\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc5f0\uc218\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 491,
          "potentialDemand2031": 478,
          "nearestParkDistanceM": 746.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "\uc778\ucc9c\uc740\uc1a1\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc5f0\uc218\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 276,
          "potentialDemand2031": 268,
          "nearestParkDistanceM": 1575.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "\uc778\ucc9c\uba85\uc120\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc5f0\uc218\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 99,
          "potentialDemand2031": 97,
          "nearestParkDistanceM": 917.9,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "\uc778\ucc9c\uc1a1\ube5b\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc5f0\uc218\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 99,
          "potentialDemand2031": 97,
          "nearestParkDistanceM": 716.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "\uc778\ucc9c\uc5f0\uc218\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc5f0\uc218\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 99,
          "potentialDemand2031": 97,
          "nearestParkDistanceM": 714.9,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "\uc778\ucc9c\ud568\ubc15\ucd08\ub4f1\ud559\uad50",
        "districtName": "\uc5f0\uc218\uad6c",
        "casePolicyLabel": "\uc720\uc9c0\u00b7\uad00\ub9ac \ub300\uc0c1",
        "caseStatusLabel": "\uc811\uadfc \uc591\ud638",
        "potentialDemand2029": 781,
        "potentialDemand2031": 794,
        "nearestParkDistanceM": 271.8,
        "greenRatio": 90.6,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "\ub0a8\ub3d9\uad6c",
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
          "schoolName": "\uc778\ucc9c\uc7a5\uc218\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ub0a8\ub3d9\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 149,
          "potentialDemand2031": 145,
          "nearestParkDistanceM": 602.6,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "\uc778\ucc9c\ub3d9\ubd80\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ub0a8\ub3d9\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 1198,
          "potentialDemand2031": 1255,
          "nearestParkDistanceM": 147.6,
          "greenRatio": 0.2,
          "playgroundCount": 2
        },
        {
          "rank": 3,
          "schoolName": "\uc778\ucc9c\uc11d\ucc9c\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ub0a8\ub3d9\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 733,
          "potentialDemand2031": 768,
          "nearestParkDistanceM": 180.0,
          "greenRatio": 0.4,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "\uc778\ucc9c\ub9cc\uc218\ubd81\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ub0a8\ub3d9\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 592,
          "potentialDemand2031": 621,
          "nearestParkDistanceM": 384.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "\uc778\ucc9c\uc0c1\uc544\ucd08\ub4f1\ud559\uad50",
          "districtName": "\ub0a8\ub3d9\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 536,
          "potentialDemand2031": 522,
          "nearestParkDistanceM": 434.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "\uc778\ucc9c\uc1a1\ucc9c\ucd08\ub4f1\ud559\uad50",
        "districtName": "\ub0a8\ub3d9\uad6c",
        "casePolicyLabel": "\uc720\uc9c0\u00b7\uad00\ub9ac \ub300\uc0c1",
        "caseStatusLabel": "\uc811\uadfc \uc591\ud638",
        "potentialDemand2029": 672,
        "potentialDemand2031": 655,
        "nearestParkDistanceM": 180.7,
        "greenRatio": 73.0,
        "playgroundCount": 1
      }
    },
    {
      "districtName": "\uacc4\uc591\uad6c",
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
          "schoolName": "\uc778\ucc9c\uc791\ub3d9\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uacc4\uc591\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 885,
          "potentialDemand2031": 902,
          "nearestParkDistanceM": 437.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "\uc778\ucc9c\ud654\uc804\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uacc4\uc591\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 814,
          "potentialDemand2031": 831,
          "nearestParkDistanceM": 400.0,
          "greenRatio": 0.1,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "\uc778\ucc9c\ubd80\ud604\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uacc4\uc591\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 765,
          "potentialDemand2031": 745,
          "nearestParkDistanceM": 327.0,
          "greenRatio": 0.6,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "\uc778\ucc9c\ubd80\ud3c9\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uacc4\uc591\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 579,
          "potentialDemand2031": 591,
          "nearestParkDistanceM": 144.2,
          "greenRatio": 0.5,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "\uc778\ucc9c\ubcd1\ubc29\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uacc4\uc591\uad6c",
          "casePolicyLabel": "\uc6b0\uc120 \uac80\ud1a0 \ub300\uc0c1",
          "caseStatusLabel": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
          "potentialDemand2029": 539,
          "potentialDemand2031": 525,
          "nearestParkDistanceM": 291.1,
          "greenRatio": 0.5,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "\uc778\ucc9c\uc2e0\ub300\ucd08\ub4f1\ud559\uad50",
        "districtName": "\uacc4\uc591\uad6c",
        "casePolicyLabel": "\uc720\uc9c0\u00b7\uad00\ub9ac \ub300\uc0c1",
        "caseStatusLabel": "\uc811\uadfc \uc591\ud638",
        "potentialDemand2029": 220,
        "potentialDemand2031": 215,
        "nearestParkDistanceM": 148.0,
        "greenRatio": 9.6,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "\uc11c\uad6c",
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
          "schoolName": "\uc778\ucc9c\uc2e0\ud604\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc11c\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 813,
          "potentialDemand2031": 822,
          "nearestParkDistanceM": 602.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "\uc778\ucc9c\uac00\uc815\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc11c\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 276,
          "potentialDemand2031": 268,
          "nearestParkDistanceM": 663.1,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "\uc778\ucc9c\ubd09\ud654\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc11c\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 276,
          "potentialDemand2031": 268,
          "nearestParkDistanceM": 608.2,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "\uc778\ucc9c\uac00\uc11d\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc11c\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 109,
          "potentialDemand2031": 106,
          "nearestParkDistanceM": 1323.0,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "\uc778\ucc9c\ucc9c\ub9c8\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uc11c\uad6c",
          "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
          "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
          "potentialDemand2029": 109,
          "potentialDemand2031": 106,
          "nearestParkDistanceM": 602.7,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "\uc778\ucc9c\uccad\uc77c\ucd08\ub4f1\ud559\uad50",
        "districtName": "\uc11c\uad6c",
        "casePolicyLabel": "\uc720\uc9c0\u00b7\uad00\ub9ac \ub300\uc0c1",
        "caseStatusLabel": "\uc811\uadfc \uc591\ud638",
        "potentialDemand2029": 897,
        "potentialDemand2031": 874,
        "nearestParkDistanceM": 140.0,
        "greenRatio": 78.8,
        "playgroundCount": 0
      }
    },
    {
      "districtName": "\uac15\ud654\uad70",
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
          "schoolName": "\uac15\ud654\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uac15\ud654\uad70",
          "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
          "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
          "potentialDemand2029": 65,
          "potentialDemand2031": 59,
          "nearestParkDistanceM": 0.0,
          "greenRatio": 0.1,
          "playgroundCount": 0
        },
        {
          "rank": 2,
          "schoolName": "\ud569\uc77c\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uac15\ud654\uad70",
          "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
          "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
          "potentialDemand2029": 65,
          "potentialDemand2031": 59,
          "nearestParkDistanceM": 0.0,
          "greenRatio": 12.7,
          "playgroundCount": 0
        },
        {
          "rank": 3,
          "schoolName": "\uae38\uc0c1\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uac15\ud654\uad70",
          "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
          "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
          "potentialDemand2029": 12,
          "potentialDemand2031": 11,
          "nearestParkDistanceM": 4242.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 4,
          "schoolName": "\uc591\ub3c4\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uac15\ud654\uad70",
          "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
          "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
          "potentialDemand2029": 3,
          "potentialDemand2031": 3,
          "nearestParkDistanceM": 4242.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        },
        {
          "rank": 5,
          "schoolName": "\uc870\uc0b0\ucd08\ub4f1\ud559\uad50",
          "districtName": "\uac15\ud654\uad70",
          "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
          "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
          "potentialDemand2029": 3,
          "potentialDemand2031": 3,
          "nearestParkDistanceM": 4242.4,
          "greenRatio": 0.0,
          "playgroundCount": 0
        }
      ],
      "bestSchool": {
        "rank": 1,
        "schoolName": "\uac11\ub8e1\ucd08\ub4f1\ud559\uad50",
        "districtName": "\uac15\ud654\uad70",
        "casePolicyLabel": "\ubcc4\ub3c4 \uc815\ucc45 \uc801\uc6a9",
        "caseStatusLabel": "\ubcc4\ub3c4 \ubb36\uc74c",
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
      "schoolName": "\uc778\ucc9c\uc11d\uc554\ucd08\ub4f1\ud559\uad50",
      "districtName": "\ubbf8\ucd94\ud640\uad6c",
      "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
      "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
      "potentialDemand2029": 824,
      "potentialDemand2031": 867,
      "nearestParkDistanceM": 947.1,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 2,
      "schoolName": "\uc778\ucc9c\ub9c8\uc7a5\ucd08\ub4f1\ud559\uad50",
      "districtName": "\ubd80\ud3c9\uad6c",
      "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
      "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
      "potentialDemand2029": 802,
      "potentialDemand2031": 782,
      "nearestParkDistanceM": 839.7,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 3,
      "schoolName": "\uc778\ucc9c\ubd80\ub9c8\ucd08\ub4f1\ud559\uad50",
      "districtName": "\ubd80\ud3c9\uad6c",
      "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
      "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
      "potentialDemand2029": 870,
      "potentialDemand2031": 934,
      "nearestParkDistanceM": 801.4,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 4,
      "schoolName": "\uc778\ucc9c\ubd80\uc6d0\ucd08\ub4f1\ud559\uad50",
      "districtName": "\ubd80\ud3c9\uad6c",
      "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
      "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
      "potentialDemand2029": 873,
      "potentialDemand2031": 938,
      "nearestParkDistanceM": 752.2,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 5,
      "schoolName": "\uc778\ucc9c\uc2e0\ud604\ucd08\ub4f1\ud559\uad50",
      "districtName": "\uc11c\uad6c",
      "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
      "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
      "potentialDemand2029": 813,
      "potentialDemand2031": 822,
      "nearestParkDistanceM": 602.1,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 6,
      "schoolName": "\uc778\ucc9c\ubbf8\uc0b0\ucd08\ub4f1\ud559\uad50",
      "districtName": "\ubd80\ud3c9\uad6c",
      "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
      "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
      "potentialDemand2029": 530,
      "potentialDemand2031": 517,
      "nearestParkDistanceM": 1143.0,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 7,
      "schoolName": "\uc778\ucc9c\uc1a1\ub2f4\ucd08\ub4f1\ud559\uad50",
      "districtName": "\uc5f0\uc218\uad6c",
      "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
      "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
      "potentialDemand2029": 491,
      "potentialDemand2031": 478,
      "nearestParkDistanceM": 746.1,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 8,
      "schoolName": "\uc778\ucc9c\uc11c\ub9bc\ucd08\ub4f1\ud559\uad50",
      "districtName": "\ub3d9\uad6c",
      "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
      "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
      "potentialDemand2029": 555,
      "potentialDemand2031": 570,
      "nearestParkDistanceM": 728.0,
      "greenRatio": 0.0,
      "playgroundCount": 0
    },
    {
      "rank": 9,
      "schoolName": "\uc778\ucc9c\ubcc4\ube5b\ucd08\ub4f1\ud559\uad50",
      "districtName": "\uc911\uad6c",
      "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
      "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
      "potentialDemand2029": 496,
      "potentialDemand2031": 473,
      "nearestParkDistanceM": 544.0,
      "greenRatio": 0.0,
      "playgroundCount": 5
    },
    {
      "rank": 10,
      "schoolName": "\uc778\ucc9c\uc2e0\uad11\ucd08\ub4f1\ud559\uad50",
      "districtName": "\uc911\uad6c",
      "casePolicyLabel": "\uc989\uc2dc \uac1c\uc120 \ub300\uc0c1",
      "caseStatusLabel": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
      "potentialDemand2029": 443,
      "potentialDemand2031": 429,
      "nearestParkDistanceM": 533.7,
      "greenRatio": 0.0,
      "playgroundCount": 7
    }
  ],
  "cityBestSchool": {
    "rank": 1,
    "schoolName": "\uc778\ucc9c\ud568\ubc15\ucd08\ub4f1\ud559\uad50",
    "districtName": "\uc5f0\uc218\uad6c",
    "casePolicyLabel": "\uc720\uc9c0\u00b7\uad00\ub9ac \ub300\uc0c1",
    "caseStatusLabel": "\uc811\uadfc \uc591\ud638",
    "potentialDemand2029": 781,
    "potentialDemand2031": 794,
    "nearestParkDistanceM": 271.8,
    "greenRatio": 90.6,
    "playgroundCount": 0
  }
};
