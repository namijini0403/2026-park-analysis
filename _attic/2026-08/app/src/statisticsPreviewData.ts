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

const michuholTopSchools: StatisticsSchoolItem[] = [
  { rank: 1, schoolName: "인천석암초등학교", districtName: "미추홀구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 629, potentialDemand2031: 602, nearestParkDistanceM: 947.1, greenRatio: 0, playgroundCount: 0 },
  { rank: 2, schoolName: "인천용현남초등학교", districtName: "미추홀구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 588, potentialDemand2031: 566, nearestParkDistanceM: 812.4, greenRatio: 0.8, playgroundCount: 0 },
  { rank: 3, schoolName: "인천주안초등학교", districtName: "미추홀구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 551, potentialDemand2031: 533, nearestParkDistanceM: 438.2, greenRatio: 1.6, playgroundCount: 0 },
  { rank: 4, schoolName: "인천도화초등학교", districtName: "미추홀구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 506, potentialDemand2031: 489, nearestParkDistanceM: 361.7, greenRatio: 2.1, playgroundCount: 0 },
  { rank: 5, schoolName: "인천관교초등학교", districtName: "미추홀구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 472, potentialDemand2031: 458, nearestParkDistanceM: 417.3, greenRatio: 2.7, playgroundCount: 1 },
];

export const cityStatisticsPreviewData: CityStatisticsData = {
  cityName: "인천광역시",
  summary: {
    schoolCount: 272,
    districtCount: 10,
    urgentSupportCount: 63,
    priorityReviewCount: 98,
    totalPotentialDemand2029: 128640,
    totalPotentialDemand2031: 124910,
  },
  districts: [
    {
      districtName: "미추홀구",
      schoolCount: 23,
      case1Count: 8,
      case2Count: 11,
      priorityReviewCount: 19,
      totalPotentialDemand2029: 9840,
      totalPotentialDemand2031: 9510,
      avgNearestParkDistanceM: 266.1,
      avgGreenRatio: 4.1,
      avgPlaygroundCount: 0.13,
      topPrioritySchools: michuholTopSchools,
      bestSchool: {
        rank: 1,
        schoolName: "인천연학초등학교",
        districtName: "미추홀구",
        casePolicyLabel: "유지·관리 대상",
        caseStatusLabel: "공원 접근 양호 · 녹지 충분",
        potentialDemand2029: 402,
        potentialDemand2031: 391,
        nearestParkDistanceM: 121.4,
        greenRatio: 17.2,
        playgroundCount: 2,
      },
    },
    {
      districtName: "서구",
      schoolCount: 42,
      case1Count: 7,
      case2Count: 15,
      priorityReviewCount: 22,
      totalPotentialDemand2029: 21840,
      totalPotentialDemand2031: 21410,
      avgNearestParkDistanceM: 318.2,
      avgGreenRatio: 9.6,
      avgPlaygroundCount: 0.72,
      topPrioritySchools: [
        { rank: 1, schoolName: "인천가좌초등학교", districtName: "서구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 702, potentialDemand2031: 684, nearestParkDistanceM: 903.8, greenRatio: 0.5, playgroundCount: 0 },
        { rank: 2, schoolName: "인천검암초등학교", districtName: "서구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 676, potentialDemand2031: 654, nearestParkDistanceM: 468.6, greenRatio: 2.1, playgroundCount: 0 },
        { rank: 3, schoolName: "인천신현북초등학교", districtName: "서구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 648, potentialDemand2031: 628, nearestParkDistanceM: 392.2, greenRatio: 2.5, playgroundCount: 1 },
        { rank: 4, schoolName: "인천가정초등학교", districtName: "서구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 620, potentialDemand2031: 601, nearestParkDistanceM: 355.1, greenRatio: 2.7, playgroundCount: 1 },
        { rank: 5, schoolName: "인천청라초등학교", districtName: "서구", casePolicyLabel: "모니터링 대상", caseStatusLabel: "공원 접근 가능 · 녹지 비율 양호", potentialDemand2029: 603, potentialDemand2031: 590, nearestParkDistanceM: 280.3, greenRatio: 5.4, playgroundCount: 1 },
      ],
      bestSchool: {
        rank: 1,
        schoolName: "인천청호초등학교",
        districtName: "서구",
        casePolicyLabel: "유지·관리 대상",
        caseStatusLabel: "공원 접근 양호 · 녹지 충분",
        potentialDemand2029: 358,
        potentialDemand2031: 347,
        nearestParkDistanceM: 156,
        greenRatio: 23.6,
        playgroundCount: 2,
      },
    },
    {
      districtName: "남동구",
      schoolCount: 38,
      case1Count: 6,
      case2Count: 13,
      priorityReviewCount: 19,
      totalPotentialDemand2029: 18730,
      totalPotentialDemand2031: 18110,
      avgNearestParkDistanceM: 301.4,
      avgGreenRatio: 8.7,
      avgPlaygroundCount: 0.66,
      topPrioritySchools: [
        { rank: 1, schoolName: "인천만수초등학교", districtName: "남동구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 671, potentialDemand2031: 650, nearestParkDistanceM: 821.7, greenRatio: 0.4, playgroundCount: 0 },
        { rank: 2, schoolName: "인천만수북초등학교", districtName: "남동구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 648, potentialDemand2031: 630, nearestParkDistanceM: 770.2, greenRatio: 0.0, playgroundCount: 0 },
        { rank: 3, schoolName: "인천간석초등학교", districtName: "남동구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 596, potentialDemand2031: 579, nearestParkDistanceM: 433.9, greenRatio: 1.8, playgroundCount: 0 },
        { rank: 4, schoolName: "인천구월초등학교", districtName: "남동구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 581, potentialDemand2031: 563, nearestParkDistanceM: 402.4, greenRatio: 2.1, playgroundCount: 1 },
        { rank: 5, schoolName: "인천논현초등학교", districtName: "남동구", casePolicyLabel: "모니터링 대상", caseStatusLabel: "공원 접근 가능 · 녹지 비율 양호", potentialDemand2029: 562, potentialDemand2031: 551, nearestParkDistanceM: 269.7, greenRatio: 4.8, playgroundCount: 1 },
      ],
      bestSchool: {
        rank: 1,
        schoolName: "인천구월서초등학교",
        districtName: "남동구",
        casePolicyLabel: "유지·관리 대상",
        caseStatusLabel: "공원 접근 양호 · 녹지 충분",
        potentialDemand2029: 344,
        potentialDemand2031: 335,
        nearestParkDistanceM: 138.2,
        greenRatio: 18.4,
        playgroundCount: 2,
      },
    },
    {
      districtName: "부평구",
      schoolCount: 29,
      case1Count: 7,
      case2Count: 10,
      priorityReviewCount: 17,
      totalPotentialDemand2029: 15380,
      totalPotentialDemand2031: 14920,
      avgNearestParkDistanceM: 344.5,
      avgGreenRatio: 6.8,
      avgPlaygroundCount: 0.49,
      topPrioritySchools: [
        { rank: 1, schoolName: "인천부마초등학교", districtName: "부평구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 612, potentialDemand2031: 591, nearestParkDistanceM: 801.4, greenRatio: 0.0, playgroundCount: 0 },
        { rank: 2, schoolName: "인천부원초등학교", districtName: "부평구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 598, potentialDemand2031: 579, nearestParkDistanceM: 752.2, greenRatio: 0.0, playgroundCount: 0 },
        { rank: 3, schoolName: "인천용마초등학교", districtName: "부평구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 562, potentialDemand2031: 544, nearestParkDistanceM: 408.0, greenRatio: 1.4, playgroundCount: 0 },
        { rank: 4, schoolName: "인천백운초등학교", districtName: "부평구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 541, potentialDemand2031: 525, nearestParkDistanceM: 389.3, greenRatio: 2.2, playgroundCount: 0 },
        { rank: 5, schoolName: "인천부흥초등학교", districtName: "부평구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 529, potentialDemand2031: 514, nearestParkDistanceM: 360.8, greenRatio: 2.7, playgroundCount: 1 },
      ],
      bestSchool: {
        rank: 1,
        schoolName: "인천갈월초등학교",
        districtName: "부평구",
        casePolicyLabel: "유지·관리 대상",
        caseStatusLabel: "공원 접근 양호 · 녹지 충분",
        potentialDemand2029: 335,
        potentialDemand2031: 326,
        nearestParkDistanceM: 141.6,
        greenRatio: 15.9,
        playgroundCount: 2,
      },
    },
    {
      districtName: "연수구",
      schoolCount: 22,
      case1Count: 4,
      case2Count: 7,
      priorityReviewCount: 11,
      totalPotentialDemand2029: 11840,
      totalPotentialDemand2031: 11520,
      avgNearestParkDistanceM: 244.7,
      avgGreenRatio: 11.3,
      avgPlaygroundCount: 0.86,
      topPrioritySchools: [
        { rank: 1, schoolName: "인천옥련초등학교", districtName: "연수구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 522, potentialDemand2031: 505, nearestParkDistanceM: 701.5, greenRatio: 0.9, playgroundCount: 0 },
        { rank: 2, schoolName: "인천동춘초등학교", districtName: "연수구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 491, potentialDemand2031: 478, nearestParkDistanceM: 418.9, greenRatio: 2.5, playgroundCount: 0 },
        { rank: 3, schoolName: "인천청량초등학교", districtName: "연수구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 480, potentialDemand2031: 469, nearestParkDistanceM: 379.6, greenRatio: 3.0, playgroundCount: 1 },
        { rank: 4, schoolName: "인천선학초등학교", districtName: "연수구", casePolicyLabel: "모니터링 대상", caseStatusLabel: "공원 접근 가능 · 녹지 비율 양호", potentialDemand2029: 463, potentialDemand2031: 452, nearestParkDistanceM: 288.1, greenRatio: 4.9, playgroundCount: 1 },
        { rank: 5, schoolName: "인천해송초등학교", districtName: "연수구", casePolicyLabel: "모니터링 대상", caseStatusLabel: "공원 접근 가능 · 녹지 비율 양호", potentialDemand2029: 451, potentialDemand2031: 443, nearestParkDistanceM: 241.2, greenRatio: 5.4, playgroundCount: 1 },
      ],
      bestSchool: {
        rank: 1,
        schoolName: "인천송도초등학교",
        districtName: "연수구",
        casePolicyLabel: "유지·관리 대상",
        caseStatusLabel: "공원 접근 양호 · 녹지 충분",
        potentialDemand2029: 298,
        potentialDemand2031: 289,
        nearestParkDistanceM: 115.8,
        greenRatio: 21.8,
        playgroundCount: 2,
      },
    },
    {
      districtName: "계양구",
      schoolCount: 25,
      case1Count: 5,
      case2Count: 8,
      priorityReviewCount: 13,
      totalPotentialDemand2029: 12120,
      totalPotentialDemand2031: 11790,
      avgNearestParkDistanceM: 286.5,
      avgGreenRatio: 8.2,
      avgPlaygroundCount: 0.54,
      topPrioritySchools: [
        { rank: 1, schoolName: "인천화전초등학교", districtName: "계양구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 548, potentialDemand2031: 531, nearestParkDistanceM: 400.0, greenRatio: 0.1, playgroundCount: 0 },
        { rank: 2, schoolName: "인천효성초등학교", districtName: "계양구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 526, potentialDemand2031: 511, nearestParkDistanceM: 682.4, greenRatio: 0.8, playgroundCount: 0 },
        { rank: 3, schoolName: "인천병방초등학교", districtName: "계양구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 504, potentialDemand2031: 489, nearestParkDistanceM: 429.5, greenRatio: 1.9, playgroundCount: 0 },
        { rank: 4, schoolName: "인천서운초등학교", districtName: "계양구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 487, potentialDemand2031: 473, nearestParkDistanceM: 388.8, greenRatio: 2.6, playgroundCount: 1 },
        { rank: 5, schoolName: "인천계산초등학교", districtName: "계양구", casePolicyLabel: "모니터링 대상", caseStatusLabel: "공원 접근 가능 · 녹지 비율 양호", potentialDemand2029: 465, potentialDemand2031: 452, nearestParkDistanceM: 274.9, greenRatio: 4.8, playgroundCount: 1 },
      ],
      bestSchool: {
        rank: 1,
        schoolName: "인천안남초등학교",
        districtName: "계양구",
        casePolicyLabel: "유지·관리 대상",
        caseStatusLabel: "공원 접근 양호 · 녹지 충분",
        potentialDemand2029: 287,
        potentialDemand2031: 278,
        nearestParkDistanceM: 126.4,
        greenRatio: 16.7,
        playgroundCount: 2,
      },
    },
    {
      districtName: "중구",
      schoolCount: 21,
      case1Count: 9,
      case2Count: 6,
      priorityReviewCount: 15,
      totalPotentialDemand2029: 10380,
      totalPotentialDemand2031: 10010,
      avgNearestParkDistanceM: 418.6,
      avgGreenRatio: 5.2,
      avgPlaygroundCount: 0.31,
      topPrioritySchools: [
        { rank: 1, schoolName: "인천용유초등학교", districtName: "중구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 508, potentialDemand2031: 489, nearestParkDistanceM: 1124.0, greenRatio: 0.0, playgroundCount: 0 },
        { rank: 2, schoolName: "인천신흥초등학교", districtName: "중구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 503, potentialDemand2031: 488, nearestParkDistanceM: 780.2, greenRatio: 0.9, playgroundCount: 0 },
        { rank: 3, schoolName: "인천신광초등학교", districtName: "중구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 498, potentialDemand2031: 484, nearestParkDistanceM: 451.8, greenRatio: 1.8, playgroundCount: 0 },
        { rank: 4, schoolName: "인천송월초등학교", districtName: "중구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 471, potentialDemand2031: 458, nearestParkDistanceM: 419.1, greenRatio: 2.2, playgroundCount: 0 },
        { rank: 5, schoolName: "인천운서초등학교", districtName: "중구", casePolicyLabel: "모니터링 대상", caseStatusLabel: "공원 접근 가능 · 녹지 비율 양호", potentialDemand2029: 446, potentialDemand2031: 434, nearestParkDistanceM: 298.3, greenRatio: 4.4, playgroundCount: 1 },
      ],
      bestSchool: {
        rank: 1,
        schoolName: "인천하늘초등학교",
        districtName: "중구",
        casePolicyLabel: "유지·관리 대상",
        caseStatusLabel: "공원 접근 양호 · 녹지 충분",
        potentialDemand2029: 274,
        potentialDemand2031: 268,
        nearestParkDistanceM: 118.3,
        greenRatio: 14.8,
        playgroundCount: 2,
      },
    },
    {
      districtName: "동구",
      schoolCount: 10,
      case1Count: 3,
      case2Count: 3,
      priorityReviewCount: 6,
      totalPotentialDemand2029: 4380,
      totalPotentialDemand2031: 4210,
      avgNearestParkDistanceM: 352.1,
      avgGreenRatio: 6.1,
      avgPlaygroundCount: 0.28,
      topPrioritySchools: [
        { rank: 1, schoolName: "인천창영초등학교", districtName: "동구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 421, potentialDemand2031: 408, nearestParkDistanceM: 744.2, greenRatio: 0.6, playgroundCount: 0 },
        { rank: 2, schoolName: "인천화수초등학교", districtName: "동구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 398, potentialDemand2031: 383, nearestParkDistanceM: 688.7, greenRatio: 0.7, playgroundCount: 0 },
        { rank: 3, schoolName: "인천송림초등학교", districtName: "동구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 377, potentialDemand2031: 364, nearestParkDistanceM: 432.5, greenRatio: 1.8, playgroundCount: 0 },
        { rank: 4, schoolName: "인천만석초등학교", districtName: "동구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 344, potentialDemand2031: 336, nearestParkDistanceM: 381.1, greenRatio: 2.4, playgroundCount: 0 },
        { rank: 5, schoolName: "인천서흥초등학교", districtName: "동구", casePolicyLabel: "모니터링 대상", caseStatusLabel: "공원 접근 가능 · 녹지 비율 양호", potentialDemand2029: 336, potentialDemand2031: 328, nearestParkDistanceM: 265.0, greenRatio: 4.1, playgroundCount: 1 },
      ],
      bestSchool: {
        rank: 1,
        schoolName: "인천동부초등학교",
        districtName: "동구",
        casePolicyLabel: "유지·관리 대상",
        caseStatusLabel: "공원 접근 양호 · 녹지 충분",
        potentialDemand2029: 198,
        potentialDemand2031: 191,
        nearestParkDistanceM: 134.9,
        greenRatio: 12.6,
        playgroundCount: 1,
      },
    },
    {
      districtName: "강화군",
      schoolCount: 38,
      case1Count: 10,
      case2Count: 4,
      priorityReviewCount: 14,
      totalPotentialDemand2029: 4210,
      totalPotentialDemand2031: 3990,
      avgNearestParkDistanceM: 512.7,
      avgGreenRatio: 12.4,
      avgPlaygroundCount: 0.21,
      topPrioritySchools: [
        { rank: 1, schoolName: "강화초등학교", districtName: "강화군", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 284, potentialDemand2031: 261, nearestParkDistanceM: 924.6, greenRatio: 1.1, playgroundCount: 0 },
        { rank: 2, schoolName: "길상초등학교", districtName: "강화군", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 262, potentialDemand2031: 241, nearestParkDistanceM: 888.1, greenRatio: 1.5, playgroundCount: 0 },
        { rank: 3, schoolName: "양도초등학교", districtName: "강화군", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 244, potentialDemand2031: 223, nearestParkDistanceM: 476.9, greenRatio: 2.8, playgroundCount: 0 },
        { rank: 4, schoolName: "교동초등학교", districtName: "강화군", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 226, potentialDemand2031: 208, nearestParkDistanceM: 438.8, greenRatio: 3.2, playgroundCount: 0 },
        { rank: 5, schoolName: "불은초등학교", districtName: "강화군", casePolicyLabel: "모니터링 대상", caseStatusLabel: "공원 접근 가능 · 녹지 비율 양호", potentialDemand2029: 211, potentialDemand2031: 196, nearestParkDistanceM: 296.2, greenRatio: 5.7, playgroundCount: 1 },
      ],
      bestSchool: {
        rank: 1,
        schoolName: "갑룡초등학교",
        districtName: "강화군",
        casePolicyLabel: "유지·관리 대상",
        caseStatusLabel: "공원 접근 양호 · 녹지 충분",
        potentialDemand2029: 138,
        potentialDemand2031: 126,
        nearestParkDistanceM: 148.1,
        greenRatio: 18.2,
        playgroundCount: 1,
      },
    },
    {
      districtName: "옹진군",
      schoolCount: 24,
      case1Count: 4,
      case2Count: 2,
      priorityReviewCount: 6,
      totalPotentialDemand2029: 1920,
      totalPotentialDemand2031: 1780,
      avgNearestParkDistanceM: 598.4,
      avgGreenRatio: 15.1,
      avgPlaygroundCount: 0.18,
      topPrioritySchools: [
        { rank: 1, schoolName: "백령초등학교", districtName: "옹진군", casePolicyLabel: "별도 정책 적용", caseStatusLabel: "별도 묶음", potentialDemand2029: 141, potentialDemand2031: 131, nearestParkDistanceM: 1040.4, greenRatio: 2.4, playgroundCount: 0 },
        { rank: 2, schoolName: "영흥초등학교", districtName: "옹진군", casePolicyLabel: "별도 정책 적용", caseStatusLabel: "별도 묶음", potentialDemand2029: 137, potentialDemand2031: 126, nearestParkDistanceM: 998.3, greenRatio: 3.0, playgroundCount: 0 },
        { rank: 3, schoolName: "덕적초등학교", districtName: "옹진군", casePolicyLabel: "별도 정책 적용", caseStatusLabel: "별도 묶음", potentialDemand2029: 129, potentialDemand2031: 119, nearestParkDistanceM: 842.6, greenRatio: 4.1, playgroundCount: 0 },
        { rank: 4, schoolName: "북도초등학교", districtName: "옹진군", casePolicyLabel: "별도 정책 적용", caseStatusLabel: "별도 묶음", potentialDemand2029: 121, potentialDemand2031: 111, nearestParkDistanceM: 716.5, greenRatio: 4.8, playgroundCount: 0 },
        { rank: 5, schoolName: "자월초등학교", districtName: "옹진군", casePolicyLabel: "별도 정책 적용", caseStatusLabel: "별도 묶음", potentialDemand2029: 113, potentialDemand2031: 104, nearestParkDistanceM: 688.2, greenRatio: 5.1, playgroundCount: 0 },
      ],
      bestSchool: {
        rank: 1,
        schoolName: "연평초등학교",
        districtName: "옹진군",
        casePolicyLabel: "유지·관리 대상",
        caseStatusLabel: "공원 접근 양호 · 녹지 충분",
        potentialDemand2029: 88,
        potentialDemand2031: 82,
        nearestParkDistanceM: 162.8,
        greenRatio: 19.4,
        playgroundCount: 1,
      },
    },
  ],
  cityTopPrioritySchools: [
    { rank: 1, schoolName: "인천가좌초등학교", districtName: "서구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 702, potentialDemand2031: 684, nearestParkDistanceM: 903.8, greenRatio: 0.5, playgroundCount: 0 },
    { rank: 2, schoolName: "인천만수초등학교", districtName: "남동구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 671, potentialDemand2031: 650, nearestParkDistanceM: 821.7, greenRatio: 0.4, playgroundCount: 0 },
    { rank: 3, schoolName: "인천검암초등학교", districtName: "서구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 676, potentialDemand2031: 654, nearestParkDistanceM: 468.6, greenRatio: 2.1, playgroundCount: 0 },
    { rank: 4, schoolName: "인천석암초등학교", districtName: "미추홀구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 629, potentialDemand2031: 602, nearestParkDistanceM: 947.1, greenRatio: 0, playgroundCount: 0 },
    { rank: 5, schoolName: "인천부마초등학교", districtName: "부평구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 612, potentialDemand2031: 591, nearestParkDistanceM: 801.4, greenRatio: 0, playgroundCount: 0 },
    { rank: 6, schoolName: "인천부원초등학교", districtName: "부평구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 598, potentialDemand2031: 579, nearestParkDistanceM: 752.2, greenRatio: 0, playgroundCount: 0 },
    { rank: 7, schoolName: "인천주안초등학교", districtName: "미추홀구", casePolicyLabel: "우선 검토 대상", caseStatusLabel: "공원 접근 가능 · 녹지 부족", potentialDemand2029: 551, potentialDemand2031: 533, nearestParkDistanceM: 438.2, greenRatio: 1.6, playgroundCount: 0 },
    { rank: 8, schoolName: "인천화전초등학교", districtName: "계양구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 548, potentialDemand2031: 531, nearestParkDistanceM: 400, greenRatio: 0.1, playgroundCount: 0 },
    { rank: 9, schoolName: "인천효성초등학교", districtName: "계양구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 526, potentialDemand2031: 511, nearestParkDistanceM: 682.4, greenRatio: 0.8, playgroundCount: 0 },
    { rank: 10, schoolName: "인천옥련초등학교", districtName: "연수구", casePolicyLabel: "즉시 개선 대상", caseStatusLabel: "공원 접근 불가", potentialDemand2029: 522, potentialDemand2031: 505, nearestParkDistanceM: 701.5, greenRatio: 0.9, playgroundCount: 0 },
  ],
  cityBestSchool: {
    rank: 1,
    schoolName: "인천청호초등학교",
    districtName: "서구",
    casePolicyLabel: "유지·관리 대상",
    caseStatusLabel: "공원 접근 양호 · 녹지 충분",
    potentialDemand2029: 358,
    potentialDemand2031: 347,
    nearestParkDistanceM: 156,
    greenRatio: 23.6,
    playgroundCount: 2,
  },
};
