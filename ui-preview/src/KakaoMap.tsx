import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    kakao: any;
    KAKAO_MAP_KEY?: string;
  }
}

export interface CandidateMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  isSchool?: boolean;
  isInternal?: boolean;
}

export interface CandidateRouteLine {
  id: string;
  path: Array<[number, number]>;
  color: string;
}

interface KakaoMapProps {
  center: { lat: number; lng: number };
  markers: CandidateMarker[];
  routes?: CandidateRouteLine[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  height?: number;
}

const DEFAULT_KAKAO_MAP_KEY = "429ad574cd834de9ebdaee46f4478138";
const ENV_KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY as string | undefined;
let kakaoLoaderPromise: Promise<void> | null = null;

function getKakaoMapKey(): string {
  const parentKey = (() => {
    try {
      return window.parent?.KAKAO_MAP_KEY;
    } catch {
      return "";
    }
  })();
  return ENV_KAKAO_KEY || window.KAKAO_MAP_KEY || parentKey || DEFAULT_KAKAO_MAP_KEY;
}

/** SDK 로드 + kakao.maps.load() 를 한 번에 처리 */
function loadKakaoSDK(): Promise<void> {
  const kakaoKey = getKakaoMapKey();
  if (!kakaoKey) {
    return Promise.reject(new Error("Kakao map key is missing."));
  }
  if (window.kakao?.maps?.Map) {
    return Promise.resolve();
  }
  if (kakaoLoaderPromise) {
    return kakaoLoaderPromise;
  }
  kakaoLoaderPromise = new Promise<void>((resolve, reject) => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve());
      return;
    }
    const existing = document.querySelector('script[data-kakao-map]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => window.kakao.maps.load(() => resolve()), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Kakao Maps SDK.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.setAttribute("data-kakao-map", "true");
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&autoload=false`;
    script.onload = () => window.kakao.maps.load(() => resolve());
    script.onerror = () => reject(new Error("Failed to load Kakao Maps SDK."));
    document.head.appendChild(script);
  });
  return kakaoLoaderPromise;
}

export default function KakaoMap({
  center,
  markers,
  routes = [],
  selected,
  onToggle,
  height = 310,
}: KakaoMapProps) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const markerEls = useRef<Map<string, { el: HTMLElement; color: string }>>(new Map());
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  // 지도 초기화 + 오버레이 생성 (markers 바뀌면 오버레이 재생성)
  useEffect(() => {
    let cancelled = false;

    loadKakaoSDK()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        setLoadError(null);

        // 기존 오버레이 제거
        overlaysRef.current.forEach((o) => o.setMap(null));
        overlaysRef.current = [];
        markerEls.current.clear();

        // 지도 초기화 (최초 1회)
        if (!mapRef.current) {
          mapRef.current = new window.kakao.maps.Map(containerRef.current, {
            center: new window.kakao.maps.LatLng(center.lat, center.lng),
            level: 4,
          });
        } else {
          mapRef.current.setCenter(new window.kakao.maps.LatLng(center.lat, center.lng));
        }

        const map = mapRef.current;
        const newOverlays: any[] = [];

        routes.forEach((route) => {
          if (!Array.isArray(route.path) || route.path.length < 2) return;
          const polyline = new window.kakao.maps.Polyline({
            path: route.path.map(([lat, lng]) => new window.kakao.maps.LatLng(lat, lng)),
            strokeWeight: 5,
            strokeColor: route.color,
            strokeOpacity: 0.9,
            strokeStyle: "solid",
            zIndex: 2,
          });
          polyline.setMap(map);
          newOverlays.push(polyline);
        });

        markers.forEach((m) => {
          const el = document.createElement("div");

          if (m.isSchool) {
          // 학교 마커: 회전 다이아몬드
          el.style.cssText = `
            width:32px; height:32px;
            background:#1a1a2e;
            border-radius:4px;
            transform:rotate(45deg);
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.35);
          `;
          const span = document.createElement("span");
          span.style.cssText = `
            transform:rotate(-45deg);
            font-size:9px; font-weight:800;
            color:#fff; line-height:1;
            font-family:Pretendard,sans-serif;
          `;
          span.textContent = "학교";
          el.appendChild(span);
          } else {
          // 후보지 마커: 원형 레이블
          const isSel = selected.has(m.id);
          el.style.cssText = `
            width:36px; height:36px;
            border-radius:50%;
            background:${isSel ? m.color : "#fff"};
            border:2.5px solid ${m.color};
            display:flex; align-items:center; justify-content:center;
            font-size:${m.isInternal ? "9px" : "14px"};
            font-weight:800;
            color:${isSel ? "#fff" : m.color};
            cursor:pointer;
            box-shadow:0 2px 8px rgba(0,0,0,0.18);
            user-select:none;
            font-family:Pretendard,sans-serif;
          `;
          el.textContent = m.label;
          el.addEventListener("click", () => onToggleRef.current(m.id));
          markerEls.current.set(m.id, { el, color: m.color });
        }

          const overlay = new window.kakao.maps.CustomOverlay({
            position: new window.kakao.maps.LatLng(m.lat, m.lng),
            content: el,
            yAnchor: 0.5,
            zIndex: m.isSchool ? 1 : 3,
          });
          overlay.setMap(map);
          newOverlays.push(overlay);
        });

        overlaysRef.current = newOverlays;
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[KakaoMap]", error);
          setLoadError("카카오맵을 불러오지 못했습니다. API 키와 도메인 등록 상태를 확인해 주세요.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [markers, routes]); // eslint-disable-line react-hooks/exhaustive-deps

  // 선택 상태 변경 → 마커 DOM만 업데이트 (지도 재초기화 없음)
  useEffect(() => {
    markerEls.current.forEach(({ el, color }, id) => {
      const isSel = selected.has(id);
      el.style.background = isSel ? color : "#fff";
      el.style.color = isSel ? "#fff" : color;
    });
  }, [selected]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        borderRadius: 12,
        border: "1px solid #dde3ec",
        overflow: "hidden",
        background: "#f0f0f0",
        position: "relative",
      }}
    >
      {loadError ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            textAlign: "center",
            fontSize: 13,
            lineHeight: 1.7,
            color: "#6b7280",
            background: "#f8fafc",
          }}
        >
          {loadError}
        </div>
      ) : null}
    </div>
  );
}
