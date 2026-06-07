for study. Unlicense
I made this for 100% Codex. 
https://studyreadbook4ever.github.io/ntn-study/


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

