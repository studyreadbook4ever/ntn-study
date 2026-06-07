# NTN Orbit Lab

정적 웹앱 기반의 교육용 NTN/위성 링크 시뮬레이터입니다. 중앙 3D 장면에서 LEO/MEO/GEO와 UE를 움직이며 coverage, Doppler, SINR, throughput, handover, ephemeris 오차가 어떻게 연결되는지 확인합니다.

## Run

```bash
npm run dev
```

브라우저에서 `http://localhost:4173`을 엽니다.

## C++ / Wasm

`cpp/ntn_core.cpp`에는 링크 예측 계산 코어가 들어 있습니다. Emscripten이 설치된 환경에서는 다음 명령으로 Wasm 빌드 골격을 사용할 수 있습니다.

```bash
npm run build:wasm
```

현재 앱은 Emscripten이 없는 환경에서도 실행되도록 같은 수식을 `src/app.js`에 포함합니다. 실제 배포 전에는 C++ 코어를 Wasm으로 연결하고 JS 계산부를 얇은 adapter로 줄이면 됩니다.

## Scope

- 계산은 실제 km, GHz, dB, Hz, ns 단위를 사용합니다.
- 화면 고도는 `log10` 압축 스케일입니다.
- 지도 타일, 고해상도 텍스처, 서버 저장 기능은 의도적으로 제외했습니다.
- v1은 교육용 직관 모델입니다. 산업용 궤도/링크 검증 도구가 아닙니다.
