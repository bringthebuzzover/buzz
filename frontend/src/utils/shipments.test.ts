import {
  carrierLabel,
  mergeShipment,
  omitShipment,
  shipmentSummary,
} from "./shipments";

describe("shipments", () => {
  it("labels carriers", () => {
    expect(carrierLabel("ups")).toBe("UPS");
    expect(carrierLabel("fedex")).toBe("FedEx");
    expect(carrierLabel("unknown")).toBe("Unknown");
  });

  it("summarizes 0/1/N", () => {
    expect(shipmentSummary([])).toBeNull();
    expect(
      shipmentSummary([
        { id: "1", trackingNumber: "1ZAA", carrier: "ups", trackUrl: "https://ups.com" },
      ]),
    ).toBe("#1ZAA");
    expect(
      shipmentSummary([
        { id: "1", trackingNumber: "1ZAA", carrier: "ups", trackUrl: null },
        { id: "2", trackingNumber: "123", carrier: "fedex", trackUrl: null },
      ]),
    ).toBe("2 tracking numbers");
  });

  it("merges by id and omits by id", () => {
    const ups = {
      id: "1",
      trackingNumber: "1ZAA",
      carrier: "ups",
      trackUrl: null,
    };
    const fedex = {
      id: "2",
      trackingNumber: "123",
      carrier: "fedex",
      trackUrl: null,
    };
    expect(mergeShipment([ups], ups)).toEqual([ups]);
    expect(mergeShipment([ups], fedex)).toEqual([ups, fedex]);
    expect(omitShipment([ups, fedex], "1")).toEqual([fedex]);
  });
});
