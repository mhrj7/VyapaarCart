export const shipmentSteps = ["label_created", "picked_up", "in_transit", "out_for_delivery", "delivered"] as const;

export type ShipmentStep = (typeof shipmentSteps)[number];

const eventCopy: Record<ShipmentStep, string> = {
  label_created: "Shipping label created. Awaiting seller handover.",
  picked_up: "Package handed to the sandbox carrier.",
  in_transit: "Package is moving through the delivery network.",
  out_for_delivery: "Package is out for delivery.",
  delivered: "Package delivered successfully.",
};

export function shipmentMessage(status: ShipmentStep) {
  return eventCopy[status];
}

export function nextShipmentStep(status: string): ShipmentStep | null {
  const index = shipmentSteps.indexOf(status as ShipmentStep);
  return index >= 0 && index < shipmentSteps.length - 1 ? shipmentSteps[index + 1] : null;
}

export function trackingNumber() {
  return `VC-SBX-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}
