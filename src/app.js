import * as THREE from "../vendor/three.module.min.js";

const EARTH_RADIUS_KM = 6371;
const C = 299792458;
const KB = 1.380649e-23;
const TEMP_K = 290;
const CITY_SIZE_KM = 240;
const ORBIT_EXIT_KM = 178;
const DEG = Math.PI / 180;
const SERVICE_MULT = { lowLatency: 1.35, balanced: 1, bulk: 0.8 };
const BANDS = {
  s: { label: "S", ghz: 2.2 },
  ku: { label: "Ku", ghz: 12 },
  ka: { label: "Ka", ghz: 28 }
};

const HELP_TEXTS = {
  "ue-demand": "Traffic demand는 이 UE가 네트워크에 요구하는 목표 전송량입니다. 값을 올리면 scheduler가 이 UE에 더 많은 bandwidth share를 주려 하지만, 위성 한 대에 여러 UE가 붙어 있거나 SINR이 낮으면 요구량을 끝까지 채우지 못합니다. 즉 demand는 사용자의 욕심이고 throughput은 물리 링크와 자원 분배가 허락한 실제 결과입니다. 이 차이를 보면 QoS 부족 상황을 직관적으로 확인할 수 있습니다.",
  "ue-service": "Service type은 같은 Mbps라도 어떤 서비스를 더 우선할지 나타내는 교육용 추상화입니다. latency-sensitive는 지연과 안정성을 더 중요하게 보고, balanced는 중립, bulk throughput은 큰 파일 전송처럼 많은 용량을 원한다고 보면 됩니다. v1에서는 bandwidth sharing 가중치에 반영됩니다. 실제망에서는 5QI, scheduler, buffer 상태, 정책 제어가 더 복잡하게 섞입니다.",
  "sat-altitude": "Altitude는 위성 고도입니다. 올리면 footprint가 넓어져 더 넓은 도시 영역을 한 번에 덮지만, range가 길어져 free-space path loss와 one-way delay가 커집니다. 내리면 LEO처럼 지연은 작고 링크가 강해질 수 있으나 coverage window가 짧아 handover가 잦아집니다. 이 앱은 화면 고도는 log scale로 압축하고 계산은 실제 km 기준으로 합니다.",
  "sat-inclination": "Inclination은 궤도면이 적도와 이루는 기울기입니다. 값이 커질수록 ground track이 남북 방향으로 더 크게 움직인다고 이해하면 됩니다. 이 v1에서는 완전한 궤도역학 대신 교육용 track 조작값으로 쓰며, 드래그 시 phase와 함께 관측창에서 위성이 지나가는 방향을 바꿉니다. 실제 궤도 설계에서는 RAAN, eccentricity, argument of perigee도 함께 봅니다.",
  "sat-beam": "Beam half-angle은 위성이 지표면으로 쏘는 빔의 반각입니다. 올리면 coverage footprint가 넓어져 더 많은 UE를 덮기 쉬우나, 빔 가장자리에서 신호가 약해지고 간섭 관리가 어려워질 수 있습니다. 내리면 좁고 집중된 coverage가 되어 SINR은 좋아질 수 있지만 빈 영역이 생깁니다. NTN에서는 넓게 덮는 것과 정확히 겨누는 것 사이의 trade-off가 중요합니다.",
  "sat-power": "Tx power는 위성 송신 전력입니다. 올리면 serving UE 입장에서는 received power와 SINR이 좋아질 수 있지만, 같은 frequency reuse group을 쓰는 다른 링크에는 더 강한 interference source가 됩니다. 내리면 간섭은 줄지만 edge UE나 먼 UE의 링크가 불안정해집니다. 그래서 실제 시스템은 전력, 빔 조향, 주파수 재사용, scheduler를 동시에 조절합니다.",
  "sat-bandwidth": "Bandwidth는 해당 위성 beam이 나눠 쓸 주파수 폭입니다. 올리면 Shannon capacity의 B가 커져 이론적 최대 전송량이 늘지만, thermal noise power도 bandwidth에 비례해 같이 증가합니다. UE가 여러 개 붙으면 이 대역폭을 demand와 service type 가중치로 나눠 씁니다. 단순히 bandwidth만 크게 한다고 모든 UE의 QoS가 해결되는 것은 아닙니다.",
  "sat-reuse": "Frequency reuse group은 같은 주파수 자원을 다시 쓰는 묶음입니다. 같은 A/B/C group에 있는 위성들은 서로 간섭원으로 계산되고, 다른 group은 간섭에서 제외됩니다. reuse를 촘촘히 하면 주파수 효율은 좋아지지만 SINR이 나빠질 수 있고, reuse를 넓히면 간섭은 줄지만 자원 효율이 떨어집니다. 위성망 설계에서 매우 현실적인 trade-off입니다.",
  "metric-status": "Status는 이 위성이 선택된 UE와 실제로 통신 가능한지 요약합니다. footprint 안에 있고, minimum elevation 조건을 만족해야 covered가 됩니다. 단순히 원 안에 들어왔다고 끝이 아니라, 너무 낮은 elevation이면 지평선 가까운 불안정 링크로 봅니다. no link가 뜨면 이 위성은 handover 후보로 쓰기 어렵고, UE는 다른 LEO/MEO/GEO 후보를 찾아야 합니다.",
  "metric-range": "Range는 UE와 위성 사이의 3D 직선거리입니다. 이 값이 커지면 전파가 더 넓게 퍼져 free-space path loss가 커지고, 빛의 속도로 이동하는 시간도 늘어 one-way delay가 증가합니다. LEO는 range가 짧아 지연이 작지만 빨리 지나가고, GEO는 range가 길어 지연과 손실이 크지만 넓은 영역을 안정적으로 덮는 비교 기준이 됩니다.",
  "metric-elevation": "Elevation은 지상 UE가 위성을 지평선에서 몇 도 위로 올려다보는지입니다. 높을수록 대기와 지형을 비스듬히 통과하는 부담이 줄고 링크가 안정적입니다. 낮은 elevation은 coverage 원 안에 있어도 실제 서비스 품질이 나빠질 수 있어 handover 후보에서 불리하게 처리합니다. NTN에서는 elevation mask가 coverage 판단의 중요한 조건입니다.",
  "metric-footprint": "Footprint는 위성 beam이 지표면에 만드는 coverage 반경입니다. 고도와 beam half-angle이 커지면 일반적으로 footprint도 커집니다. 하지만 너무 넓은 footprint는 에너지가 퍼져 edge UE의 품질이 낮아지고, 같은 reuse group과 겹칠 때 interference도 커질 수 있습니다. 넓은 coverage와 높은 link quality는 항상 같이 가지 않는다는 점을 보여주는 지표입니다.",
  "metric-fspl": "FSPL은 free-space path loss입니다. 수식은 32.44 + 20log10(distance_km) + 20log10(frequency_MHz)이고, 거리와 주파수가 커질수록 dB 단위 손실이 증가합니다. dB가 커진다는 것은 같은 송신전력으로 UE에 도달하는 신호가 약해진다는 뜻입니다. 고도와 주파수 선택이 throughput에 왜 직접 영향을 주는지 설명하는 핵심 항목입니다.",
  "metric-sinr": "SINR은 Signal to Interference plus Noise Ratio입니다. serving satellite의 신호 S가 같은 reuse group 간섭 I와 thermal noise N에 비해 얼마나 강한지 보는 값입니다. 높을수록 같은 bandwidth에서 더 높은 throughput을 기대할 수 있습니다. 송신전력을 올리면 내 링크는 좋아질 수 있지만 다른 링크의 간섭도 키울 수 있어, 단순한 ‘전력 올리기’가 항상 정답은 아닙니다.",
  "metric-throughput": "Throughput은 이 앱이 계산한 실제 제공 Mbps입니다. 먼저 SINR과 bandwidth로 Shannon capacity를 구하고, 같은 위성에 붙은 UE들끼리 demand와 service type 기준으로 대역폭을 나눕니다. 마지막으로 UE가 요구한 demand를 넘지 않게 cap합니다. 따라서 낮은 throughput은 물리 링크가 나쁘거나, 간섭이 크거나, 같은 beam에 경쟁 UE가 많다는 신호입니다.",
  "metric-demand-met": "Demand met은 UE가 요구한 traffic demand 대비 실제 throughput이 몇 퍼센트 채워졌는지입니다. 100%에 가까우면 요구 QoS를 만족하고, 낮으면 사용자는 버퍼링, 지연 증가, 품질 저하를 겪는 상황으로 해석할 수 있습니다. 이 값은 단순 수신 전력보다 사용자 경험에 가까운 지표입니다. handover와 자원 분배 결과를 한눈에 보는 데 유용합니다.",
  "metric-doppler": "Doppler는 위성과 UE 사이의 상대속도 때문에 carrier frequency가 밀리는 양입니다. 위성이 다가오면 주파수가 높아지고 멀어지면 낮아지는 식으로 생각하면 됩니다. 값은 carrier frequency에 비례하므로 Ka처럼 높은 주파수에서는 같은 속도 변화도 더 큰 Hz 오차가 됩니다. LEO/MEO에서 synchronization과 tracking이 어려운 이유를 보여주는 핵심 지표입니다.",
  "metric-one-way-delay": "One-way delay는 전파가 UE와 위성 사이를 한 번 이동하는 시간입니다. 전파는 빛의 속도에 가깝게 움직이므로 range가 길수록 delay가 커집니다. LEO는 짧은 delay가 장점이고, GEO는 넓은 coverage 대신 큰 delay를 감수합니다. 실시간성 있는 서비스에서는 round-trip delay까지 고려해야 하므로 이 값이 작을수록 체감 품질에 유리합니다.",
  "metric-interference": "Interference는 serving link가 아닌 다른 위성 신호가 같은 주파수 자원을 쓰면서 끼어드는 전력입니다. 이 앱은 같은 frequency reuse group의 위성만 interference source로 합산합니다. 값이 커지면 SINR이 낮아지고 throughput이 줄어듭니다. coverage가 많이 겹치는 것이 항상 좋은 것은 아니며, 주파수 계획과 beam isolation이 왜 필요한지 보여줍니다.",
  "metric-noise": "Noise는 열잡음 전력입니다. 전자기기와 수신기에는 온도에 따른 기본 잡음이 있고, bandwidth가 넓어질수록 더 많은 잡음도 함께 들어옵니다. 그래서 bandwidth를 키우면 capacity의 B는 커지지만 noise도 증가합니다. 실제 시스템에서는 receiver noise figure, implementation loss 등이 추가되며, v1은 교육용으로 kTB 기반 thermal noise를 사용합니다.",
  "eph-pos": "Predicted position error는 ephemeris age와 RMS 오차가 누적된 위성 위치 예측 오차입니다. 실제 위치와 예측 위치가 달라지면 footprint 중심, range, elevation이 같이 틀어집니다. 그 결과 아직 coverage 안이라고 믿었는데 실제로는 edge 밖이거나, handover 후보를 늦게 고르는 상황이 생깁니다. ghost satellite는 이 예측 위치를 시각적으로 보여줍니다.",
  "eph-vel": "Velocity error RMS는 위성 속도 예측의 평균적인 오차입니다. Doppler는 상대속도에 의해 생기므로, 위치가 어느 정도 맞아도 속도 예측이 틀리면 Doppler residual이 남습니다. 특히 높은 carrier frequency에서는 작은 속도 오차도 큰 Hz 오차가 됩니다. 이 항목은 NTN 수신기가 왜 ephemeris와 tracking loop를 함께 신경 써야 하는지 보여줍니다.",
  "eph-clock": "Clock bias range error는 시계 오차를 거리 오차로 환산한 값입니다. 빛은 1ns 동안 약 30cm를 이동하므로, ns 단위 시간 오차도 위성 링크에서는 의미 있는 range error가 됩니다. GNSS와 NTN 모두 시간 기준이 매우 중요합니다. clock bias가 커지면 timing advance, scheduling, range estimation이 흔들리고 handover 판단도 간접적으로 나빠질 수 있습니다.",
  "eph-dopp": "Doppler residual은 예측과 보상 후에도 남는 Doppler 오차입니다. 수신기는 carrier frequency가 어디쯤 있을지 예측하고 따라가야 하는데, ephemeris 속도 오차가 있으면 잔차가 남습니다. 잔차가 커질수록 synchronization, demodulation, channel estimation이 어려워집니다. 교육용 위험도에서는 이 값을 handover risk에도 일부 반영합니다.",
  "eph-time": "Timing error는 위치/시계 오차가 시간축에서 얼마나 밀리는지입니다. range error를 빛의 속도로 나누면 ns 단위 시간 오차가 됩니다. NTN에서는 propagation delay 자체가 크고 계속 변하므로, 작은 timing error도 scheduling window나 uplink timing advance에 영향을 줄 수 있습니다. 이 앱은 고등학교 물리 수준의 거리=속도×시간 관계로 이를 보여줍니다.",
  "eph-risk": "Handover risk는 range error와 Doppler residual을 합쳐 만든 교육용 위험도입니다. 실제 표준의 단일 수식은 아니지만, ephemeris가 나빠질수록 coverage 판단, Doppler 보정, 후보 위성 선택이 동시에 불안정해진다는 직관을 주기 위한 값입니다. 높을수록 잘못된 위성을 선택하거나, handover가 늦어 link drop으로 이어질 가능성이 커진다고 보면 됩니다.",
  "tmi-ephemeris-state": "Ephemeris state는 위성의 위치 r(t), 속도 v(t), clock 상태를 시간에 따라 예측하는 데이터 묶음입니다. NTN에서는 이 값이 단순 지도 표시용이 아니라 range, Doppler, delay, coverage, handover 후보 선택에 모두 들어갑니다. 그래서 ephemeris가 오래되거나 부정확하면 여러 지표가 한꺼번에 틀어집니다. 이 앱의 핵심 TMI는 바로 그 오차 전파를 눈으로 보여주는 것입니다.",
  "tmi-position-error": "Position error는 예측한 위성 위치와 실제 위치의 차이입니다. line-of-sight 방향 오차는 range와 delay에 직접 들어가고, 지표면 방향 오차는 footprint 중심과 elevation 판단을 밀어냅니다. 도시 패치 위에서 위성을 드래그하면 UE와 footprint 중심 거리, coverage 판정, handover 후보가 어떻게 같이 바뀌는지 볼 수 있습니다. ghost satellite는 예측 위치를 뜻합니다.",
  "tmi-velocity-error": "Velocity error는 위성이 어느 방향으로 얼마나 빠르게 움직이는지 예측이 틀린 정도입니다. Doppler는 상대속도에 carrier frequency를 곱해 생기는 효과라, 속도 오차는 곧 Doppler residual로 이어집니다. 특히 LEO는 빠르게 움직이므로 MEO/GEO보다 Doppler 변화가 커집니다. 이 지표는 NTN이 단순 coverage 문제가 아니라 동기화 문제이기도 하다는 점을 보여줍니다.",
  "tmi-clock-bias": "Clock bias는 위성 또는 시스템 시각 기준이 실제보다 앞서거나 뒤처지는 오차입니다. 빛의 속도가 매우 빠르기 때문에 1ns 오차도 약 30cm range error가 됩니다. 작은 숫자로 보이지만 위성 링크에서는 timing advance, ranging, scheduling에 영향을 줍니다. 위치와 속도만 맞추면 끝이 아니라 시간 기준까지 맞아야 NTN 링크 예측이 안정적이라는 것을 보여줍니다.",
  "tmi-ephemeris-age": "Ephemeris age는 마지막으로 받은 위성 예측 정보가 얼마나 오래됐는지입니다. 시간이 지날수록 실제 궤도와 예측 궤도는 조금씩 벌어진다고 보는 것이 자연스럽습니다. update interval을 줄이면 최신성이 좋아져 오차는 작아지지만, 제어 채널과 운영 비용은 늘어납니다. 즉 정확도와 갱신 비용 사이의 trade-off를 설명하는 항목입니다.",
  "tmi-coverage-decision": "Coverage decision은 footprint 안에 있는지와 minimum elevation을 동시에 보는 판단입니다. 위성 빔 원 안에 들어와도 elevation이 너무 낮으면 지평선 근처 링크라 path가 길고 불안정할 수 있습니다. ephemeris가 틀리면 footprint 위치와 elevation 예측이 틀어져 false positive나 false negative가 생깁니다. handover 실패 시나리오와 직접 연결됩니다.",
  "tmi-handover-timing": "Handover timing은 언제 serving satellite를 바꿀지 정하는 문제입니다. 너무 빨리 바꾸면 잠깐 좋아진 후보로 왔다 갔다 하는 ping-pong이 생기고, 너무 늦게 바꾸면 link drop이 납니다. 그래서 margin과 time-to-trigger를 둡니다. 이 앱은 coverage, elevation, SINR, capacity headroom, ephemeris risk를 합쳐 교육용 handover 판단을 구성합니다.",
  "tmi-free-space-path-loss": "Free-space path loss는 전파가 공간으로 퍼지면서 약해지는 손실입니다. 거리와 주파수에 로그로 증가합니다. 고도를 올리면 coverage는 넓어질 수 있지만 range가 길어져 손실이 커지고, 높은 주파수 대역은 대역폭 확보에 유리하지만 path loss와 Doppler 측면에서 더 까다롭습니다. 링크 예산을 이해하는 가장 기본적인 수식입니다.",
  "tmi-sinr-and-interference": "SINR and interference는 serving signal이 간섭과 잡음에 비해 얼마나 강한지 보는 항목입니다. 같은 reuse group의 위성이 같은 지역을 덮으면 interference가 커져 SINR이 낮아집니다. 반대로 reuse를 분리하면 간섭은 줄지만 주파수 효율이 떨어질 수 있습니다. 실제 NTN 설계에서는 coverage를 많이 겹치는 것보다 간섭을 관리하는 것이 더 어려운 경우가 많습니다.",
  "tmi-shannon-capacity": "Shannon capacity는 주어진 bandwidth와 SINR에서 이론적으로 가능한 최대 정보량입니다. 실제 5G NTN은 MCS, coding, scheduler, HARQ, implementation loss 때문에 이 값보다 낮지만, 교육용 기준선으로는 매우 좋습니다. bandwidth를 키우면 capacity는 늘지만 noise도 같이 커지고, SINR이 낮으면 bandwidth가 넓어도 효율이 떨어진다는 점을 보여줍니다.",
  "tmi-beam-pointing": "Beam pointing은 위성 빔이 UE 또는 cell 중심을 얼마나 정확히 겨누는지입니다. UE가 beam 중심에 가까우면 안테나 이득이 좋고, 가장자리로 갈수록 edge attenuation이 커집니다. 위성을 드래그하면 footprint 중심과 UE 거리, SINR, throughput이 함께 바뀝니다. 이 항목은 coverage 원 안에 들어오는 것과 실제 품질이 좋은 것이 다르다는 점을 설명합니다.",
  "tmi-frequency-reuse": "Frequency reuse는 제한된 주파수 자원을 여러 위성이 다시 쓰는 방식입니다. 같은 reuse group을 가까운 지역에서 많이 쓰면 spectrum efficiency는 좋아 보이지만 interference가 커질 수 있습니다. 다른 group으로 분리하면 간섭은 줄지만 사용 가능한 자원이 나뉩니다. 이 앱의 A/B/C reuse 색상은 그 trade-off를 단순화해 보여주는 교육용 장치입니다.",
  "tmi-bandwidth-sharing": "Bandwidth sharing은 한 위성 beam의 대역폭을 여러 UE가 나눠 쓰는 규칙입니다. 이 앱은 각 UE의 traffic demand와 service type 가중치를 사용해 share를 계산합니다. 많은 UE가 같은 위성에 몰리면 각자 받을 수 있는 throughput이 줄어들고, demand를 다 채우지 못할 수 있습니다. coverage가 된다는 사실만으로 QoS가 보장되지 않는 이유를 보여줍니다.",
  "tmi-geo-comparison": "GEO comparison은 LEO/MEO와 GEO의 trade-off를 보기 위한 기준입니다. GEO는 이 도시 패치 전체를 거의 항상 덮는 것으로 두지만, 고도가 매우 높아 range, path loss, delay가 큽니다. 반대로 LEO는 지연이 작고 링크가 강할 수 있으나 빠르게 지나가 handover와 Doppler가 커집니다. 같은 UE에 대해 어떤 궤도가 어떤 장단점을 갖는지 비교하기 좋습니다.",
  "tmi-leo-re-entry": "LEO re-entry는 실제 지구 전체 궤도를 모두 그리지 않는 대신 도시 관측창만 표현하기 위한 시적 허용입니다. 위성이 창을 벗어나면 원점 기준 반대편에서 다시 들어오게 하여, 총 위성 수를 유지하면서 coverage window의 진입과 이탈을 계속 보여줍니다. 계산 모델의 핵심은 관측창 안에서의 range, Doppler, footprint, handover 변화입니다."
  ,
  "tmi-geo-role": "GEO 위성은 지구 자전과 같은 각속도로 움직여 지상에서는 거의 고정된 것처럼 보이는 기준 위성입니다. 이 앱에서는 도시 패치 전체를 덮는 비교군으로 둡니다. 장점은 넓고 안정적인 coverage와 낮은 handover 부담이고, 단점은 매우 큰 range 때문에 one-way delay와 path loss가 커진다는 점입니다. LEO/MEO와 비교해 ‘안정성 대 지연’ trade-off를 보여줍니다.",
  "tmi-meo-role": "MEO 위성은 LEO와 GEO 사이의 중간 궤도입니다. LEO보다 느리게 지나가고 footprint가 넓어 handover 빈도는 낮아질 수 있지만, GEO보다는 낮아 delay와 path loss가 덜합니다. 이 앱에서는 LEO와 직접 비교하기 쉽게 조작 가능한 후보 위성으로 둡니다. 사용자가 MEO를 움직이면 coverage, Doppler, SINR, handover 후보성이 LEO와 어떻게 다른지 확인할 수 있습니다.",
  "tmi-leo-role": "LEO 위성은 낮은 고도에서 빠르게 지나가는 위성입니다. range가 짧아 delay와 path loss는 유리하지만, 움직임이 빨라 Doppler 변화가 크고 coverage window가 짧아 handover가 자주 필요합니다. 이 앱의 주인공에 가까운 궤도입니다. 사용자가 LEO를 드래그하거나 시간이 흐르게 두면 footprint가 도시를 지나가며 UE 연결, Doppler, handover risk가 계속 바뀌는 모습을 볼 수 있습니다."
};

const state = {
  paused: false,
  speed: 1,
  simTime: 0,
  selected: { type: "sat", id: "LEO-1" },
  selectedUeId: "UE-1",
  freqGhz: 2.2,
  handoverMemory: {},
  events: [],
  lexical: {
    term: "Ephemeris",
    text: "Ephemeris는 위성이 어느 시각에 어디에 있고 어떤 속도로 움직이는지 예측하는 데이터입니다. NTN에서는 이 예측이 range, Doppler, coverage, handover timing에 동시에 들어갑니다. 위치가 수백 m만 어긋나도 링크 품질 계산과 후보 위성 판단이 흔들릴 수 있습니다."
  }
};

const satellites = [
  sat("LEO-1", "LEO", -160, -80, 550, 52, 0, 36, 47, 120, "A", 30),
  sat("LEO-2", "LEO", -80, 60, 700, 56, 40, 32, 46, 100, "B", 24),
  sat("LEO-3", "LEO", 0, -130, 900, 48, 88, 30, 46, 110, "C", 22),
  sat("LEO-4", "LEO", 80, 120, 1100, 42, 122, 28, 45, 90, "A", 20),
  sat("LEO-5", "LEO", 150, -20, 1200, 64, 190, 26, 45, 90, "B", 18),
  sat("LEO-6", "LEO", -190, 130, 650, 60, 250, 34, 46, 100, "C", 24),
  sat("MEO-1", "MEO", -78, 74, 10000, 56, 20, 18, 50, 180, "A", 14),
  sat("MEO-2", "MEO", 78, -72, 16000, 48, 150, 16, 50, 180, "B", 12),
  sat("MEO-3", "MEO", 94, 36, 20200, 55, 270, 14, 50, 180, "C", 10),
  sat("GEO-1", "GEO", 115, 95, 35786, 0, 0, 8, 54, 250, "A", 0)
];

const ues = [
  ue("UE-1", -70, -70, 35, "balanced"),
  ue("UE-2", 70, -60, 55, "bulk"),
  ue("UE-3", -50, 65, 20, "lowLatency"),
  ue("UE-4", 60, 65, 75, "balanced"),
  ue("UE-5", 0, 0, 45, "bulk"),
  ue("UE-6", 105, 10, 15, "lowLatency")
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1016);

const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(310, 230, 420);
camera.lookAt(0, 22, 0);

const canvas = document.querySelector("#scene");
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setSize(innerWidth, innerHeight);
} catch (error) {
  console.error(error);
  canvas.replaceWith(Object.assign(document.createElement("div"), {
    id: "scene",
    textContent: "WebGL is unavailable in this browser context. Metrics and controls are still usable."
  }));
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const dragHit = new THREE.Vector3();
let dragging = null;

const root = new THREE.Group();
scene.add(root);

const ambient = new THREE.AmbientLight(0xffffff, 0.72);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(90, 160, 80);
scene.add(sun);

const materials = {
  ground: new THREE.MeshStandardMaterial({ color: 0x26343b, roughness: 0.92 }),
  road: new THREE.MeshBasicMaterial({ color: 0x111820 }),
  cell: new THREE.MeshBasicMaterial({ color: 0x546a79, transparent: true, opacity: 0.18, side: THREE.DoubleSide }),
  coverageOk: new THREE.MeshBasicMaterial({ color: 0x55d7ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
  coverageWarn: new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.13, side: THREE.DoubleSide }),
  coverageGeo: new THREE.MeshBasicMaterial({ color: 0xff9b54, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
  ue: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
  ghost: new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.28, wireframe: true }),
  lineServing: new THREE.LineBasicMaterial({ color: 0x64e6a3 }),
  lineCandidate: new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.55 }),
  lineBad: new THREE.LineBasicMaterial({ color: 0xff6b6b, transparent: true, opacity: 0.65 })
};

const satColors = { LEO: 0x55d7ff, MEO: 0xb493ff, GEO: 0xff9b54 };
const satMeshes = new Map();
const ueMeshes = new Map();
const linkLines = [];

buildCity();
buildAltitudeScale();
buildTheory();
buildUeControls();
buildObjects();
bindUi();
renderLexical();
renderMetrics();
logEvent("Simulator ready: log10 altitude view, real-unit calculations.");

let last = performance.now();
if (renderer) {
  renderer.setAnimationLoop((now) => {
    const dt = Math.min((now - last) / 1000, 0.08);
    last = now;
    if (!state.paused) step(dt * state.speed);
    draw();
  });
} else {
  setInterval(() => {
    if (!state.paused) step(0.12 * state.speed);
    renderMetrics();
  }, 120);
}

function sat(id, orbit, x, z, altitudeKm, inclinationDeg, phaseDeg, beamHalfAngleDeg, txPowerDbw, bandwidthMhz, reuse, phaseRateDegS) {
  return {
    id,
    orbit,
    x,
    z,
    altitudeKm,
    inclinationDeg,
    phaseDeg,
    beamHalfAngleDeg,
    txPowerDbw,
    bandwidthMhz,
    reuse,
    phaseRateDegS,
    trackAngleDeg: phaseDeg,
    minElevationDeg: orbit === "GEO" ? 5 : 10,
    ephAgeSec: orbit === "GEO" ? 25 : 80,
    updateIntervalSec: orbit === "GEO" ? 60 : 120,
    positionErrorRmsM: orbit === "GEO" ? 160 : 420,
    velocityErrorRmsMps: orbit === "GEO" ? 0.015 : 0.08,
    clockBiasNs: orbit === "GEO" ? 12 : 28,
    object: null,
    coverage: null,
    ghost: null
  };
}

function ue(id, x, z, demandMbps, serviceType) {
  return {
    id,
    x,
    z,
    demandMbps,
    serviceType,
    active: true,
    servingSatId: null,
    handoverCandidateId: null,
    tttSec: 0
  };
}

function buildCity() {
  const ground = new THREE.Mesh(new THREE.BoxGeometry(CITY_SIZE_KM, 2, CITY_SIZE_KM), materials.ground);
  ground.position.y = -1;
  root.add(ground);

  const cellGeom = new THREE.PlaneGeometry(CITY_SIZE_KM / 2 - 3, CITY_SIZE_KM / 2 - 3);
  [-1, 1].forEach((ix) => {
    [-1, 1].forEach((iz) => {
      const cell = new THREE.Mesh(cellGeom, materials.cell);
      cell.rotation.x = -Math.PI / 2;
      cell.position.set(ix * CITY_SIZE_KM / 4, 0.05, iz * CITY_SIZE_KM / 4);
      root.add(cell);
    });
  });

  const roadW = 8;
  const road1 = new THREE.Mesh(new THREE.BoxGeometry(CITY_SIZE_KM, 0.2, roadW), materials.road);
  road1.position.y = 0.18;
  root.add(road1);
  const road2 = new THREE.Mesh(new THREE.BoxGeometry(roadW, 0.2, CITY_SIZE_KM), materials.road);
  road2.position.y = 0.19;
  root.add(road2);

  const buildingMat = new THREE.MeshStandardMaterial({ color: 0x344957, roughness: 0.85 });
  for (let i = 0; i < 38; i++) {
    const w = 7 + (i % 5) * 3;
    const h = 5 + (i * 7) % 24;
    const d = 7 + (i % 4) * 4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), buildingMat);
    const x = -105 + (i % 10) * 23;
    const z = -98 + Math.floor(i / 10) * 54 + ((i % 2) * 8);
    if (Math.abs(x) < 12 || Math.abs(z) < 12) continue;
    b.position.set(x, h / 2, z);
    root.add(b);
  }
}

function buildObjects() {
  satellites.forEach((s) => {
    const mat = new THREE.MeshStandardMaterial({ color: satColors[s.orbit], roughness: 0.28, metalness: 0.25 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(s.orbit === "GEO" ? 5.5 : 4.3, 24, 12), mat);
    mesh.userData = { type: "sat", id: s.id };
    s.object = mesh;
    root.add(mesh);

    const cov = new THREE.Mesh(new THREE.CircleGeometry(1, 96), s.orbit === "GEO" ? materials.coverageGeo : materials.coverageOk);
    cov.rotation.x = -Math.PI / 2;
    s.coverage = cov;
    root.add(cov);

    const ghost = new THREE.Mesh(new THREE.SphereGeometry(5.1, 16, 8), materials.ghost);
    s.ghost = ghost;
    root.add(ghost);
    satMeshes.set(s.id, mesh);
  });

  ues.forEach((u) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 7, 16), materials.ue);
    mesh.userData = { type: "ue", id: u.id };
    mesh.position.set(u.x, 3.5, u.z);
    root.add(mesh);
    ueMeshes.set(u.id, mesh);
  });
}

function bindUi() {
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (renderer) renderer.setSize(innerWidth, innerHeight);
  });

  if (renderer) {
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", () => { dragging = null; });
    renderer.domElement.addEventListener("pointerleave", () => { dragging = null; });
  }

  document.querySelector("#pauseBtn").addEventListener("click", () => {
    state.paused = !state.paused;
    document.querySelector("#pauseBtn").textContent = state.paused ? "Play" : "Pause";
  });

  document.querySelector("#speedBtn").addEventListener("click", () => {
    state.speed = state.speed === 1 ? 10 : 1;
    document.querySelector("#speedBtn").textContent = `${state.speed}x`;
  });

  document.querySelector("#bandSelect").addEventListener("change", (event) => {
    const value = event.target.value;
    if (value !== "custom") {
      state.freqGhz = BANDS[value].ghz;
      document.querySelector("#freqInput").value = state.freqGhz;
    }
    renderMetrics();
  });

  document.querySelector("#freqInput").addEventListener("input", (event) => {
    state.freqGhz = clamp(Number(event.target.value) || 2.2, 0.1, 60);
    document.querySelector("#bandSelect").value = "custom";
    renderMetrics();
  });

  document.querySelector("#leoHelpBtn").addEventListener("click", () => document.querySelector("#orbitDialog").showModal());
  document.querySelector("#theoryToggle").addEventListener("click", () => document.querySelector(".theory-panel").classList.toggle("open"));
  document.addEventListener("click", (event) => {
    const btn = event.target.closest(".help-btn");
    if (!btn) return;
    state.lexical = {
      term: btn.dataset.term ?? "Keyword",
      text: btn.dataset.help ?? "설명이 아직 연결되지 않았습니다."
    };
    renderLexical();
  });
}

function onPointerDown(event) {
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...satMeshes.values(), ...ueMeshes.values()], false);
  if (!hits.length) return;

  const data = hits[0].object.userData;
  state.selected = { type: data.type, id: data.id };
  if (data.type === "ue") state.selectedUeId = data.id;
  dragging = data;
  renderMetrics();
}

function onPointerMove(event) {
  setPointer(event);
  if (!dragging) return;

  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(dragPlane, dragHit);

  if (dragging.type === "ue") {
    const u = ues.find((item) => item.id === dragging.id);
    u.x = clamp(dragHit.x, -CITY_SIZE_KM / 2, CITY_SIZE_KM / 2);
    u.z = clamp(dragHit.z, -CITY_SIZE_KM / 2, CITY_SIZE_KM / 2);
  } else {
    const s = satellites.find((item) => item.id === dragging.id);
    if (s.orbit === "GEO") return;
    s.x = clamp(dragHit.x, -CITY_SIZE_KM, CITY_SIZE_KM);
    s.z = clamp(dragHit.z, -CITY_SIZE_KM, CITY_SIZE_KM);
    s.phaseDeg = ((Math.atan2(s.z, s.x) / DEG) + 360) % 360;
    s.trackAngleDeg = s.phaseDeg;
    const radial = Math.sqrt(s.x * s.x + s.z * s.z);
    const targetAlt = visualRadialToAltitude(radial, s.orbit);
    s.altitudeKm = clamp(targetAlt, s.orbit === "LEO" ? 400 : 6000, s.orbit === "LEO" ? 2000 : 25000);
  }

  resolveLinks();
  renderMetrics();
}

function setPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function step(dt) {
  state.simTime += dt;
  satellites.forEach((s) => {
    s.ephAgeSec += dt;
    if (s.ephAgeSec > s.updateIntervalSec * 1.5) s.ephAgeSec = s.updateIntervalSec * 0.4;
    if (s.orbit === "GEO" || dragging?.id === s.id) return;
    const angle = s.trackAngleDeg * DEG;
    const visualSpeed = s.orbit === "LEO" ? 42 : 16;
    s.x += Math.cos(angle) * visualSpeed * dt;
    s.z += Math.sin(angle) * visualSpeed * dt;
    s.phaseDeg = ((Math.atan2(s.z, s.x) / DEG) + 360) % 360;
    if (Math.abs(s.x) > ORBIT_EXIT_KM || Math.abs(s.z) > ORBIT_EXIT_KM) {
      s.x = -clamp(s.x, -ORBIT_EXIT_KM, ORBIT_EXIT_KM);
      s.z = -clamp(s.z, -ORBIT_EXIT_KM, ORBIT_EXIT_KM);
      logEvent(`${s.id} left the city window and re-entered from the opposite side.`);
    }
  });
  resolveLinks();
  if (Math.floor(state.simTime * 2) % 2 === 0) renderMetrics();
}

function draw() {
  if (!renderer) return;
  satellites.forEach((s) => {
    const y = altitudeToVisualY(s.altitudeKm) + (s.orbit === "GEO" ? 38 : 0);
    s.object.position.set(s.x, y, s.z);
    const radius = s.orbit === "GEO" ? CITY_SIZE_KM * 0.92 : clamp(coverageRadiusKm(s), 18, 175);
    s.coverage.position.set(s.x, 0.25, s.z);
    s.coverage.scale.set(radius, radius, 1);
    s.coverage.material = linkableSatelliteIds().has(s.id) ? materials.coverageOk : materials.coverageWarn;
    if (s.orbit === "GEO") s.coverage.material = materials.coverageGeo;
    const ghost = predictedPosition(s);
    s.ghost.position.set(ghost.x, y + ghost.dy, ghost.z);
  });

  ues.forEach((u) => {
    const mesh = ueMeshes.get(u.id);
    mesh.visible = u.active;
    mesh.position.set(u.x, 3.5, u.z);
    mesh.material.color.set(u.id === state.selectedUeId ? 0x64e6a3 : 0xffffff);
  });

  linkLines.forEach((line) => root.remove(line));
  linkLines.length = 0;
  ues.filter((u) => u.active).forEach((u) => {
    const serving = satellites.find((s) => s.id === u.servingSatId);
    if (serving) addLine(new THREE.Vector3(u.x, 4, u.z), serving.object.position, materials.lineServing);
    satellites.filter((s) => s.id !== u.servingSatId && isCovered(s, u)).slice(0, 2)
      .forEach((s) => addLine(new THREE.Vector3(u.x, 4, u.z), s.object.position, materials.lineCandidate));
  });

  renderer.render(scene, camera);
}

function addLine(a, b, mat) {
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat);
  linkLines.push(line);
  root.add(line);
}

function resolveLinks() {
  const capacityBySat = new Map();
  ues.filter((u) => u.active).forEach((u) => {
    const ranked = satellites
      .map((s) => ({ s, link: estimateLink(s, u) }))
      .filter((x) => x.link.covered && x.link.elevationDeg >= x.s.minElevationDeg)
      .sort((a, b) => b.link.score - a.link.score);

    const current = ranked.find((x) => x.s.id === u.servingSatId);
    const best = ranked[0];
    if (!best) {
      if (u.servingSatId) logEvent(`${u.id} link dropped: no coverage window.`);
      u.servingSatId = null;
      u.handoverCandidateId = null;
      u.tttSec = 0;
      return;
    }

    const currentScore = current?.link.score ?? -Infinity;
    const shouldMove = !current || best.link.score > currentScore + 3 || !current.link.covered;
    if (shouldMove) {
      if (u.handoverCandidateId !== best.s.id) {
        u.handoverCandidateId = best.s.id;
        u.tttSec = 0;
      } else {
        u.tttSec += 0.12 * state.speed;
      }
      if (u.tttSec >= 1.2) {
        const old = u.servingSatId ?? "none";
        u.servingSatId = best.s.id;
        u.tttSec = 0;
        logEvent(`${u.id} handover: ${old} -> ${best.s.id} (${best.link.sinrDb.toFixed(1)} dB SINR).`);
      }
    } else {
      u.handoverCandidateId = null;
      u.tttSec = 0;
    }
  });

  satellites.forEach((s) => capacityBySat.set(s.id, ues.filter((u) => u.active && u.servingSatId === s.id)));
  capacityBySat.forEach((attached, satId) => {
    if (attached.length > 3) logEvent(`${satId} capacity pressure: ${attached.length} UEs share one beam.`);
  });
}

function estimateLink(s, u) {
  const dx = s.x - u.x;
  const dz = s.z - u.z;
  const groundKm = Math.sqrt(dx * dx + dz * dz);
  const rangeKm = Math.sqrt(groundKm * groundKm + s.altitudeKm * s.altitudeKm);
  const elevationDeg = Math.atan2(s.altitudeKm, Math.max(groundKm, 0.001)) / DEG;
  const radiusKm = s.orbit === "GEO" ? CITY_SIZE_KM : coverageRadiusKm(s);
  const covered = groundKm <= radiusKm && elevationDeg >= s.minElevationDeg;
  const edgeRatio = clamp(groundKm / Math.max(radiusKm, 1), 0, 1.4);
  const beamLossDb = 12 * edgeRatio * edgeRatio;
  const fsplDb = 32.44 + 20 * Math.log10(rangeKm) + 20 * Math.log10(state.freqGhz * 1000);
  const rxDbw = s.txPowerDbw + 30 + 26 - fsplDb - beamLossDb;
  const interferenceDbw = interferencePowerDbw(s, u);
  const noiseDbw = noisePowerDbw(s.bandwidthMhz);
  const sinrLin = dbToLin(rxDbw) / (dbToLin(noiseDbw) + dbToLin(interferenceDbw));
  const sinrDb = linToDb(sinrLin);
  const rawCapacityMbps = s.bandwidthMhz * Math.log2(1 + Math.max(sinrLin, 0));
  const share = bandwidthShare(s, u);
  const capacityMbps = rawCapacityMbps * share;
  const deliveredMbps = Math.min(u.demandMbps, Math.max(0, capacityMbps));
  const qos = u.demandMbps <= 0 ? 1 : deliveredMbps / u.demandMbps;
  const vRadMps = radialVelocityMps(s, u, rangeKm);
  const dopplerHz = (vRadMps / C) * state.freqGhz * 1e9;
  const delayMs = (rangeKm * 1000 / C) * 1000;
  const eph = ephemerisEffect(s, rangeKm, dopplerHz);
  const score = (covered ? 20 : -100) + sinrDb + elevationDeg * 0.08 - edgeRatio * 3 - eph.handoverRisk * 4;
  return { groundKm, rangeKm, elevationDeg, radiusKm, edgeRatio, covered, fsplDb, rxDbw, interferenceDbw, noiseDbw, sinrDb, rawCapacityMbps, capacityMbps, deliveredMbps, qos, dopplerHz, delayMs, eph, score };
}

function interferencePowerDbw(serving, u) {
  const powers = satellites
    .filter((s) => s.id !== serving.id && s.reuse === serving.reuse)
    .map((s) => {
      const dx = s.x - u.x;
      const dz = s.z - u.z;
      const groundKm = Math.sqrt(dx * dx + dz * dz);
      const rangeKm = Math.sqrt(groundKm * groundKm + s.altitudeKm * s.altitudeKm);
      const radiusKm = s.orbit === "GEO" ? CITY_SIZE_KM : coverageRadiusKm(s);
      if (groundKm > radiusKm * 1.2) return -Infinity;
      const edge = clamp(groundKm / Math.max(radiusKm, 1), 0, 1.5);
      const fsplDb = 32.44 + 20 * Math.log10(rangeKm) + 20 * Math.log10(state.freqGhz * 1000);
      return s.txPowerDbw + 30 + 26 - fsplDb - 15 * edge * edge;
    })
    .filter(Number.isFinite);
  if (!powers.length) return -220;
  return linToDb(powers.reduce((sum, p) => sum + dbToLin(p), 0));
}

function bandwidthShare(s, u) {
  const attached = ues.filter((item) => item.active && item.servingSatId === s.id);
  if (!attached.length) return 1;
  const total = attached.reduce((sum, item) => sum + item.demandMbps * SERVICE_MULT[item.serviceType], 0);
  const own = u.demandMbps * SERVICE_MULT[u.serviceType];
  return clamp(own / Math.max(total, 0.001), 0.04, 1);
}

function ephemerisEffect(s, rangeKm, dopplerHz) {
  const ageFactor = 1 + s.ephAgeSec / Math.max(s.updateIntervalSec, 1);
  const positionErrorM = s.positionErrorRmsM * ageFactor;
  const velocityErrorMps = s.velocityErrorRmsMps * ageFactor;
  const clockRangeM = C * s.clockBiasNs * 1e-9;
  const rangeErrorM = Math.sqrt(positionErrorM ** 2 + clockRangeM ** 2);
  const dopplerResidualHz = Math.abs(dopplerHz) * (velocityErrorMps / 7600) + (velocityErrorMps / C) * state.freqGhz * 1e9;
  const timingErrorNs = (rangeErrorM / C) * 1e9;
  const handoverRisk = clamp((rangeErrorM / 1200) + (dopplerResidualHz / 180), 0, 5);
  return { positionErrorM, velocityErrorMps, clockRangeM, rangeErrorM, dopplerResidualHz, timingErrorNs, handoverRisk };
}

function coverageRadiusKm(s) {
  const beam = s.beamHalfAngleDeg * DEG;
  const flat = s.altitudeKm * Math.tan(beam);
  const horizon = Math.sqrt((EARTH_RADIUS_KM + s.altitudeKm) ** 2 - EARTH_RADIUS_KM ** 2);
  return Math.min(flat, horizon);
}

function radialVelocityMps(s, u, rangeKm) {
  if (s.orbit === "GEO") return 18 * Math.sin(state.simTime / 90);
  const speed = orbitalSpeedMps(s.altitudeKm);
  const tangent = new THREE.Vector2(Math.cos(s.trackAngleDeg * DEG), Math.sin(s.trackAngleDeg * DEG));
  const los = new THREE.Vector2(u.x - s.x, u.z - s.z).normalize();
  return speed * tangent.dot(los) * 0.7;
}

function orbitalSpeedMps(altitudeKm) {
  const mu = 3.986004418e14;
  return Math.sqrt(mu / ((EARTH_RADIUS_KM + altitudeKm) * 1000));
}

function altitudeToVisualY(altitudeKm) {
  return 18 + Math.log10(altitudeKm + 1) * 32;
}

function visualRadialToAltitude(radial, orbit) {
  const norm = clamp(radial / CITY_SIZE_KM, 0, 1);
  if (orbit === "LEO") return 400 + norm * 1600;
  return 6000 + norm * 19000;
}

function predictedPosition(s) {
  const errKm = ephemerisEffect(s, s.altitudeKm, 0).positionErrorM / 1000;
  const phase = (s.phaseDeg + 37) * DEG;
  return { x: s.x + Math.cos(phase) * errKm * 0.18, z: s.z + Math.sin(phase) * errKm * 0.18, dy: Math.min(errKm * 0.04, 12) };
}

function isCovered(s, u) {
  return estimateLink(s, u).covered;
}

function linkableSatelliteIds() {
  const ids = new Set();
  ues.filter((u) => u.active).forEach((u) => satellites.forEach((s) => {
    if (isCovered(s, u)) ids.add(s.id);
  }));
  return ids;
}

function buildUeControls() {
  const wrap = document.querySelector("#ueControls");
  wrap.innerHTML = "";
  ues.forEach((u) => {
    const el = document.createElement("article");
    el.className = "ue-card";
    el.innerHTML = `
      <header>
        <b>${u.id}</b>
        <span class="chip ${u.active ? "ok" : "bad"}">${u.active ? "ON" : "OFF"}</span>
        <button title="hide UE" data-action="toggle" data-id="${u.id}">${u.active ? "x" : "+"}</button>
      </header>
      <label>
        <span class="label-row">Traffic demand: <b id="${u.id}-demand">${u.demandMbps}</b> Mbps ${help(`ue-${u.id}-demand`, "올리면 이 UE가 요구하는 Mbps가 커집니다. 같은 위성에 여러 UE가 붙으면 더 큰 수요가 bandwidth share를 더 많이 가져가지만, SINR이 낮으면 요구량을 채우지 못합니다.")}</span>
        <input type="range" min="1" max="150" value="${u.demandMbps}" data-action="demand" data-id="${u.id}" />
      </label>
      <label>
        <span class="label-row">Service type ${help(`ue-${u.id}-service`, "latency-sensitive는 지연과 안정성을 더 중요하게 보는 트래픽이고, bulk throughput은 많은 Mbps를 요구하는 트래픽입니다. v1에서는 bandwidth sharing 가중치에 반영됩니다.")}</span>
        <select data-action="service" data-id="${u.id}">
          <option value="lowLatency" ${u.serviceType === "lowLatency" ? "selected" : ""}>latency-sensitive</option>
          <option value="balanced" ${u.serviceType === "balanced" ? "selected" : ""}>balanced</option>
          <option value="bulk" ${u.serviceType === "bulk" ? "selected" : ""}>bulk throughput</option>
        </select>
      </label>
    `;
    wrap.append(el);
  });

  wrap.addEventListener("input", (event) => {
    const id = event.target.dataset.id;
    const u = ues.find((item) => item.id === id);
    if (!u) return;
    if (event.target.dataset.action === "demand") {
      u.demandMbps = Number(event.target.value);
      document.getElementById(`${u.id}-demand`).textContent = u.demandMbps;
    }
    if (event.target.dataset.action === "service") u.serviceType = event.target.value;
    resolveLinks();
    renderMetrics();
  });

  wrap.addEventListener("click", (event) => {
    if (event.target.dataset.action !== "toggle") return;
    const u = ues.find((item) => item.id === event.target.dataset.id);
    u.active = !u.active;
    if (!u.active) u.servingSatId = null;
    buildUeControls();
    resolveLinks();
    renderMetrics();
  });
}

function renderMetrics() {
  const selectedSat = state.selected.type === "sat"
    ? satellites.find((s) => s.id === state.selected.id)
    : satellites.find((s) => s.id === ues.find((u) => u.id === state.selected.id)?.servingSatId) ?? satellites[0];
  const selectedUe = ues.find((u) => u.id === state.selectedUeId) ?? ues[0];
  const link = estimateLink(selectedSat, selectedUe);
  document.querySelector("#selectedTitle").textContent = `${selectedSat.id} -> ${selectedUe.id}`;
  document.querySelector("#selectedHint").textContent = `${selectedSat.orbit} / reuse ${selectedSat.reuse}`;

  const metrics = document.querySelector("#metrics");
  metrics.innerHTML = `
    <article class="sat-card">
      <header>
        <b>${selectedSat.id}</b>
        <span class="chip ${selectedSat.orbit.toLowerCase()}">${selectedSat.orbit}</span>
      </header>
      <label>
        <span class="label-row">Altitude ${selectedSat.altitudeKm.toFixed(0)} km ${help("sat-altitude", "올리면 coverage와 delay가 커지고, path loss도 대체로 커집니다. 내리면 LEO 특성이 강해져 지연은 줄지만 coverage window가 짧아집니다.")}</span>
        <input data-sat="${selectedSat.id}" data-field="altitudeKm" type="range" min="${selectedSat.orbit === "LEO" ? 400 : 6000}" max="${selectedSat.orbit === "LEO" ? 2000 : 25000}" value="${selectedSat.altitudeKm}" ${selectedSat.orbit === "GEO" ? "disabled" : ""}>
      </label>
      <label>
        <span class="label-row">Inclination ${selectedSat.inclinationDeg.toFixed(0)} deg ${help("sat-inclination", "올리면 ground track이 남북 방향 성분을 더 갖는다고 이해하면 됩니다. v1에서는 교육용 조작값이며 실제 6개 궤도요소 전체를 풀지는 않습니다.")}</span>
        <input data-sat="${selectedSat.id}" data-field="inclinationDeg" type="range" min="0" max="90" value="${selectedSat.inclinationDeg}" ${selectedSat.orbit === "GEO" ? "disabled" : ""}>
      </label>
      <label>
        <span class="label-row">Beam half-angle ${selectedSat.beamHalfAngleDeg.toFixed(1)} deg ${help("sat-beam", "올리면 footprint가 넓어져 더 많은 UE를 덮지만, beam edge와 간섭 관리가 어려워집니다. 내리면 좁고 집중된 coverage가 됩니다.")}</span>
        <input data-sat="${selectedSat.id}" data-field="beamHalfAngleDeg" type="range" min="4" max="42" value="${selectedSat.beamHalfAngleDeg}">
      </label>
      <label>
        <span class="label-row">Tx power ${selectedSat.txPowerDbw.toFixed(1)} dBW ${help("sat-power", "올리면 수신 신호와 SINR이 좋아질 수 있지만, 같은 reuse group에서는 다른 UE에게 간섭원이 되기도 합니다.")}</span>
        <input data-sat="${selectedSat.id}" data-field="txPowerDbw" type="range" min="35" max="58" value="${selectedSat.txPowerDbw}">
      </label>
      <label>
        <span class="label-row">Bandwidth ${selectedSat.bandwidthMhz.toFixed(0)} MHz ${help("sat-bandwidth", "올리면 Shannon capacity가 커지지만 열잡음도 함께 커집니다. UE가 여러 개면 이 대역폭을 demand와 service type 기준으로 나눠 씁니다.")}</span>
        <input data-sat="${selectedSat.id}" data-field="bandwidthMhz" type="range" min="20" max="300" value="${selectedSat.bandwidthMhz}">
      </label>
      <label>
        <span class="label-row">Frequency reuse group ${help("sat-reuse", "같은 reuse group의 위성끼리는 같은 주파수 자원을 재사용한다고 보고 간섭을 계산합니다. 다르게 두면 간섭이 줄어드는 효과를 볼 수 있습니다.")}</span>
        <select data-sat="${selectedSat.id}" data-field="reuse">
          ${["A", "B", "C"].map((r) => `<option ${selectedSat.reuse === r ? "selected" : ""}>${r}</option>`).join("")}
        </select>
      </label>
    </article>
    <div class="metric-grid">
      ${metric("Status", link.covered ? "covered" : "no link", link.covered ? "ok" : "bad", "coverage footprint와 최소 elevation 조건을 동시에 만족하는지입니다. no link면 이 위성으로는 통신 불가입니다.")}
      ${metric("Range", `${link.rangeKm.toFixed(1)} km`, null, "UE와 위성 사이의 3D 직선거리입니다. 커질수록 path loss와 전파 지연이 증가합니다.")}
      ${metric("Elevation", `${link.elevationDeg.toFixed(1)} deg`, null, "지평선에서 위성을 올려다보는 각도입니다. 낮으면 대기 경로가 길고 링크가 불안정해져 handover 후보에서 밀립니다.")}
      ${metric("Footprint", `${link.radiusKm.toFixed(1)} km`, null, "위성 beam이 지표면에 만드는 coverage 반경입니다. 고도와 beam angle을 올리면 커지지만 간섭/전력 밀도 관점에서는 불리해질 수 있습니다.")}
      ${metric("FSPL", `${link.fsplDb.toFixed(1)} dB`, null, "자유공간 경로손실입니다. 거리와 주파수가 커질수록 커집니다. dB가 커질수록 수신 신호는 약해집니다.")}
      ${metric("SINR", `${link.sinrDb.toFixed(1)} dB`, link.sinrDb > 8 ? "ok" : link.sinrDb > 0 ? "warn" : "bad", "Signal to Interference plus Noise Ratio입니다. 수신신호를 키우거나 간섭/잡음을 줄이면 올라가며 throughput의 핵심 입력입니다.")}
      ${metric("Throughput", `${link.deliveredMbps.toFixed(1)} / ${selectedUe.demandMbps} Mbps`, null, "Shannon capacity와 bandwidth sharing 뒤 실제로 UE 요구량 중 얼마나 채우는지입니다. demand보다 많이 받지는 않게 cap합니다.")}
      ${metric("Demand met", `${(link.qos * 100).toFixed(0)}%`, link.qos > 0.85 ? "ok" : link.qos > 0.45 ? "warn" : "bad", "UE가 요구한 Mbps 대비 실제 제공량입니다. 100%에 가까울수록 QoS 요구를 만족합니다.")}
      ${metric("Doppler", `${link.dopplerHz.toFixed(1)} Hz`, null, "위성-UE 거리 변화 속도 때문에 carrier frequency가 밀리는 양입니다. 주파수와 상대속도를 올리면 커집니다.")}
      ${metric("One-way delay", `${link.delayMs.toFixed(2)} ms`, null, "전파가 위성까지 한 번 가는 데 걸리는 시간입니다. 고도가 높을수록 GEO처럼 지연이 커집니다.")}
      ${metric("Interference", `${link.interferenceDbw.toFixed(1)} dBW`, null, "같은 frequency reuse group의 다른 위성이 만드는 간섭입니다. reuse를 분리하거나 geometry를 바꾸면 줄어듭니다.")}
      ${metric("Noise", `${link.noiseDbw.toFixed(1)} dBW`, null, "열잡음입니다. bandwidth를 올리면 더 많은 정보를 보낼 수 있지만, 잡음 전력도 같이 증가합니다.")}
    </div>
    <article class="metric-card">
      <div class="metric-row"><span class="metric-label">Predicted position error ${help("eph-pos", "ephemeris age와 RMS 오차가 누적된 예측 위치 오차입니다. 커질수록 coverage와 handover 판단이 틀어질 수 있습니다.")}</span><b>${link.eph.positionErrorM.toFixed(1)} m</b></div>
      <div class="metric-row"><span class="metric-label">Velocity error RMS ${help("eph-vel", "속도 예측 오차입니다. 상대속도 기반 Doppler 예측에 직접 영향을 줍니다.")}</span><b>${link.eph.velocityErrorMps.toFixed(3)} m/s</b></div>
      <div class="metric-row"><span class="metric-label">Clock bias range error ${help("eph-clock", "시계 오차를 빛의 속도로 곱하면 거리 오차가 됩니다. ns 단위 오차도 링크 예측에는 의미가 있습니다.")}</span><b>${link.eph.clockRangeM.toFixed(2)} m</b></div>
      <div class="metric-row"><span class="metric-label">Doppler residual ${help("eph-dopp", "보상하고 남는 Doppler 오차입니다. 커질수록 수신기가 carrier tracking을 더 어렵게 느낍니다.")}</span><b>${link.eph.dopplerResidualHz.toFixed(2)} Hz</b></div>
      <div class="metric-row"><span class="metric-label">Timing error ${help("eph-time", "거리/시계 오차가 시간축에서 얼마만큼 밀리는지입니다. 동기화와 scheduling 설명에 연결됩니다.")}</span><b>${link.eph.timingErrorNs.toFixed(1)} ns</b></div>
      <div class="metric-row"><span class="metric-label">Handover risk ${help("eph-risk", "range error와 Doppler residual을 합쳐 만든 교육용 위험도입니다. 높으면 잘못된 후보 위성을 고르거나 handover가 늦어질 수 있습니다.")}</span><b>${link.eph.handoverRisk.toFixed(2)}</b></div>
    </article>
    <article class="metric-card">
      <div class="metric-row"><span>Serving UE</span><b>${selectedUe.servingSatId ?? "none"}</b></div>
      <div class="metric-row"><span>Candidate</span><b>${selectedUe.handoverCandidateId ?? "none"}</b></div>
      <div class="metric-row"><span>Time-to-trigger</span><b>${selectedUe.tttSec.toFixed(2)} s</b></div>
      <p class="formula">handover = coverage + elevation + SINR margin + capacity headroom + time-to-trigger</p>
    </article>
  `;

  metrics.querySelectorAll("input,select").forEach((input) => input.addEventListener("input", (event) => {
    const s = satellites.find((item) => item.id === event.target.dataset.sat);
    const field = event.target.dataset.field;
    if (field === "reuse") s[field] = event.target.value;
    else s[field] = Number(event.target.value);
    resolveLinks();
    renderMetrics();
  }));
}

function metric(label, value, chip, explanation) {
  const id = `metric-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return `<div class="metric-card"><div class="metric-row"><span class="metric-label">${label} ${help(id, explanation)}</span>${chip ? `<span class="chip ${chip}">${value}</span>` : `<b>${value}</b>`}</div></div>`;
}

function help(id, text) {
  const helpText = HELP_TEXTS[normalizeHelpId(id)] ?? text;
  const term = id
    .replace(/^(sat|ue|metric|eph)-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  return `<button class="help-btn" type="button" data-term="${escapeAttr(term)}" data-help="${escapeAttr(helpText)}" aria-label="${escapeAttr(term)} 설명 보기">?</button>`;
}

function renderLexical() {
  document.querySelector("#lexicalTitle").textContent = state.lexical.term;
  document.querySelector("#lexicalText").textContent = state.lexical.text;
}

function normalizeHelpId(id) {
  return id.toLowerCase().replace(/ue-ue-\d+-/, "ue-");
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildTheory() {
  const items = [
    ["GEO Role", "GEO ~= fixed wide coverage, high delay", "GEO 위성은 이 앱에서 도시 전체를 덮는 안정적인 비교 기준입니다. handover 부담은 작지만 고도가 높아 delay와 path loss가 큽니다."],
    ["MEO Role", "MEO = middle orbit, middle trade-off", "MEO 위성은 LEO와 GEO 사이의 중간 선택지입니다. coverage와 handover 안정성은 LEO보다 낫고, delay는 GEO보다 작게 비교할 수 있습니다."],
    ["LEO Role", "LEO = low altitude, fast moving, frequent handover", "LEO 위성은 낮고 빠르게 움직입니다. 지연은 작지만 Doppler와 handover가 커서 NTN 동적성을 가장 직관적으로 보여줍니다."],
    ["Ephemeris state", "state = position r(t) + velocity v(t) + clock", "ephemeris는 위성의 위치와 속도를 시간 함수로 예측하는 약속입니다. NTN에서는 이 값이 coverage, Doppler, delay, handover 후보 선택에 동시에 들어가므로 하나가 틀리면 여러 지표가 함께 흔들립니다."],
    ["Position error", "range error ~= line-of-sight projection of position error", "위성 위치 예측이 옆으로 틀리면 footprint 중심이 밀리고, 앞뒤로 틀리면 range가 바로 틀어집니다. 사용자는 ghost satellite와 실제 위성 간격으로 이 오차를 봅니다."],
    ["Velocity error", "doppler residual ~= (velocity error / c) * carrier frequency", "Doppler는 상대속도 기반입니다. 위치가 맞아도 속도 예측이 틀리면 수신기가 보정해야 할 주파수 잔차가 남습니다. 고주파일수록 같은 속도 오차가 더 큰 Hz 오차가 됩니다."],
    ["Clock bias", "range error = c * time bias", "시계 오차는 곧 거리 오차입니다. 빛은 1 ns에 약 30 cm를 가므로 작은 시간 오차도 우주 링크에서는 무시하기 어렵습니다. 이 앱은 clock bias를 range error와 timing error에 넣습니다."],
    ["Ephemeris age", "error grows as age / update interval increases", "갱신한 지 오래된 ephemeris일수록 예측은 낡습니다. update interval을 줄이면 최신 정보가 들어오지만 네트워크/제어 비용이 늘어난다고 이해하면 됩니다."],
    ["Coverage decision", "covered = inside footprint AND elevation > minimum", "coverage는 단순히 원 안에 있는지가 아닙니다. elevation이 너무 낮으면 지평선 가까운 링크라 불안정하므로 후보에서 제외합니다. 예측 위치가 틀리면 이 판단도 틀릴 수 있습니다."],
    ["Handover timing", "handover = margin + time-to-trigger + capacity headroom", "LEO/MEO는 계속 지나가므로 handover가 빠르면 ping-pong, 늦으면 drop이 됩니다. time-to-trigger는 조건이 잠깐 좋아진 것인지 진짜 바꿀 때인지 기다리는 안전장치입니다."],
    ["Free-space path loss", "FSPL(dB)=32.44+20log10(d_km)+20log10(f_MHz)", "거리가 멀고 주파수가 높을수록 전파가 더 넓게 퍼집니다. 손전등 빛이 멀어질수록 흐려지는 것과 같은 직관입니다. 고도 조절이 throughput에 영향을 주는 핵심 이유입니다."],
    ["SINR and interference", "SINR=S/(I+N)", "쓸 신호 S를 간섭 I와 열잡음 N이 방해합니다. 같은 reuse group의 위성이 많으면 interference가 올라가고, bandwidth를 올리면 capacity는 늘지만 noise도 같이 올라갑니다."],
    ["Shannon capacity", "C=B log2(1+SINR)", "완벽한 코딩을 가정한 이론상 최대 전송량입니다. 실제 5G NTN 장비는 MCS, scheduler, coding loss 때문에 더 낮지만, 교육용으로 추세를 보기 좋은 기준선입니다."],
    ["Beam pointing", "off-axis loss grows near beam edge", "빔 중심에서 멀어질수록 안테나 이득이 줄어드는 것으로 모델링합니다. 위성을 드래그하면 UE와 footprint 중심의 거리가 바뀌고, 이 값이 SINR과 throughput에 바로 반영됩니다."],
    ["Frequency reuse", "same reuse group => interference source", "위성들이 항상 서로 다른 주파수만 쓰면 간섭은 줄지만 자원 효율이 떨어집니다. 이 앱은 A/B/C reuse group을 두고 같은 group만 간섭원으로 합산합니다."],
    ["Bandwidth sharing", "share_i = weighted demand_i / sum(weighted demand)", "한 위성 beam에 여러 UE가 붙으면 bandwidth를 나눠 씁니다. traffic demand와 service type 가중치가 share를 정하고, UE는 자기 demand보다 더 많이 받지는 않습니다."],
    ["GEO comparison", "high altitude => wide coverage + high delay", "GEO는 이 도시 영역 전체를 덮는 비교 기준입니다. handover는 적지만 one-way delay와 path loss가 커서 LEO/MEO와 trade-off를 비교하기 좋습니다."],
    ["LEO re-entry", "exit window => reflected opposite entry", "교육용 시적 허용입니다. 실제 궤도 전체를 그리지 않고, 도시 관측창을 벗어난 위성이 원점 반대편에서 다시 들어오는 방식으로 coverage window 변화를 보여줍니다."]
  ];
  document.querySelector("#theoryContent").innerHTML = items.map(([title, formula, text]) => `
    <article class="theory-card">
      <header><b>${title}</b>${help(`tmi-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, `${formula}. ${text}`)}</header>
      <p class="formula">${formula}</p>
    </article>
  `).join("");
}

function buildAltitudeScale() {
  const scale = document.querySelector("#altitude-scale");
  [500, 2000, 10000, 20000, 35786].forEach((km) => {
    const top = 230 - (Math.log10(km) - Math.log10(400)) / (Math.log10(36000) - Math.log10(400)) * 220;
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.top = `${top}px`;
    tick.textContent = `${km.toLocaleString()} km`;
    scale.append(tick);
  });
}

function logEvent(message) {
  const last = state.events[state.events.length - 1];
  if (last?.message === message && state.simTime - last.t < 2) return;
  state.events.push({ message, t: state.simTime });
  state.events = state.events.slice(-5);
  document.querySelector("#event-log").innerHTML = state.events
    .slice().reverse()
    .map((event) => `<div class="event">${event.message}</div>`)
    .join("");
}

function noisePowerDbw(bandwidthMhz) {
  return linToDb(KB * TEMP_K * bandwidthMhz * 1e6);
}

function dbToLin(db) {
  return 10 ** (db / 10);
}

function linToDb(lin) {
  return 10 * Math.log10(Math.max(lin, 1e-30));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
