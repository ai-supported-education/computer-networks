export const LAB_IMAGE =
  "ghcr.io/nicolaka/netshoot:v0.16@sha256:b09d9b21381f47a79b3cbcb30da25266dc17186ea00ae65e99fdc51396f48e70";

export const LAB_LABEL_KEY = "dev.training.network-lab";
export const LAB_OWNER_LABEL = "computer-networks";
export const LAB_RUN_LABEL_KEY = "dev.training.network-lab.run";
export const LAB_ROLE_LABEL_KEY = "dev.training.network-lab.role";

export const LAB_NETWORK = {
  subnet: "172.30.0.0/24",
  driver: "bridge",
  gatewayModeOption: "com.docker.network.bridge.gateway_mode_ipv4",
  gatewayMode: "isolated"
} as const;

export const LAB_ENDPOINTS = {
  alpha: {
    role: "alpha",
    name: "cn-alpha",
    ipv4: "172.30.0.10",
    mac: "02:42:ac:1e:00:0a"
  },
  beta: {
    role: "beta",
    name: "cn-beta",
    ipv4: "172.30.0.20",
    mac: "02:42:ac:1e:00:14"
  }
} as const;

export const KNOWN_FIXTURE_SHA256 =
  "8a4036d450c9f0953c50286f2dc99d429873900e8f92f22a1d2f8f6f1b6dc64f";

export const CAPTURE_LIMITS = {
  durationSeconds: 3,
  framesPerPhase: 8,
  maxBytes: 1024 * 1024,
  pingCount: 1,
  pingWaitSeconds: 2
} as const;

export const DOCKER_ID_PATTERN = /^[a-f0-9]{64}$/;
