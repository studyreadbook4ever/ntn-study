#include <cmath>

extern "C" {

struct LinkEstimate {
  double range_km;
  double elevation_deg;
  double fspl_db;
  double rx_dbw;
  double sinr_db;
  double capacity_mbps;
  double doppler_hz;
  double delay_ms;
  double coverage_radius_km;
};

static constexpr double kEarthRadiusKm = 6371.0;
static constexpr double kC = 299792458.0;
static constexpr double kKb = 1.380649e-23;
static constexpr double kTempK = 290.0;
static constexpr double kPi = 3.14159265358979323846;

double db_to_lin(double db) {
  return std::pow(10.0, db / 10.0);
}

double lin_to_db(double lin) {
  return 10.0 * std::log10(std::fmax(lin, 1e-30));
}

double coverage_radius_km(double altitude_km, double beam_half_angle_deg) {
  const double beam = beam_half_angle_deg * kPi / 180.0;
  const double flat = altitude_km * std::tan(beam);
  const double horizon = std::sqrt(
      (kEarthRadiusKm + altitude_km) * (kEarthRadiusKm + altitude_km) -
      kEarthRadiusKm * kEarthRadiusKm);
  return std::fmin(flat, horizon);
}

LinkEstimate estimate_link(
    double sat_x_km,
    double sat_z_km,
    double altitude_km,
    double ue_x_km,
    double ue_z_km,
    double carrier_ghz,
    double beam_half_angle_deg,
    double tx_power_dbw,
    double bandwidth_mhz,
    double interference_dbw,
    double radial_velocity_mps) {
  const double dx = sat_x_km - ue_x_km;
  const double dz = sat_z_km - ue_z_km;
  const double ground_km = std::sqrt(dx * dx + dz * dz);
  const double range_km = std::sqrt(ground_km * ground_km + altitude_km * altitude_km);
  const double elevation_deg = std::atan2(altitude_km, std::fmax(ground_km, 0.001)) * 180.0 / kPi;
  const double radius_km = coverage_radius_km(altitude_km, beam_half_angle_deg);
  const double edge_ratio = std::fmin(1.4, ground_km / std::fmax(radius_km, 1.0));
  const double beam_loss_db = 12.0 * edge_ratio * edge_ratio;
  const double fspl_db = 32.44 + 20.0 * std::log10(range_km) + 20.0 * std::log10(carrier_ghz * 1000.0);
  const double rx_dbw = tx_power_dbw + 30.0 + 26.0 - fspl_db - beam_loss_db;
  const double noise_dbw = lin_to_db(kKb * kTempK * bandwidth_mhz * 1e6);
  const double sinr = db_to_lin(rx_dbw) / (db_to_lin(noise_dbw) + db_to_lin(interference_dbw));
  const double capacity_mbps = bandwidth_mhz * std::log2(1.0 + std::fmax(sinr, 0.0));
  const double doppler_hz = (radial_velocity_mps / kC) * carrier_ghz * 1e9;
  const double delay_ms = (range_km * 1000.0 / kC) * 1000.0;

  return {
      range_km,
      elevation_deg,
      fspl_db,
      rx_dbw,
      lin_to_db(sinr),
      capacity_mbps,
      doppler_hz,
      delay_ms,
      radius_km};
}

}
