package vehicle;

public class SmallVan extends DeliveryVehicle {

    public SmallVan(String vehicleId, double capacityKg) {
        super(vehicleId, capacityKg);
    }

    // A van can carry any positive load up to its capacity
    @Override
    public boolean canCarry(double loadKg) {
        return loadKg > 0 && loadKg <= capacityKg;
    }

    @Override
    public String getVehicleType() {
        return "Small Van";
    }
}
