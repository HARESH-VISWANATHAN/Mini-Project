package vehicle;

public class SupplyTruck extends DeliveryVehicle {

    // A truck trip is only worthwhile for loads of at least this size
    public static final double MIN_ECONOMIC_LOAD_KG = 250;

    public SupplyTruck(String vehicleId, double capacityKg) {
        super(vehicleId, capacityKg);
    }

    // Different rule from SmallVan: a truck also needs a minimum load
    @Override
    public boolean canCarry(double loadKg) {
        return loadKg >= MIN_ECONOMIC_LOAD_KG && loadKg <= capacityKg;
    }

    @Override
    public String getVehicleType() {
        return "Supply Truck";
    }
}
