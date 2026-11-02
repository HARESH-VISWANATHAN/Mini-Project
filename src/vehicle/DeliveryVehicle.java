package vehicle;

/**
 * INHERITANCE + ABSTRACTION: the common part of every vehicle.
 * Each subclass decides for itself whether it can carry a load.
 */
public abstract class DeliveryVehicle {

    protected final String vehicleId;
    protected final double capacityKg;
    private boolean available = true;

    public DeliveryVehicle(String vehicleId, double capacityKg) {
        if (vehicleId == null || vehicleId.trim().isEmpty()) {
            throw new IllegalArgumentException("Vehicle ID is required.");
        }
        if (!Double.isFinite(capacityKg) || capacityKg <= 0) {
            throw new IllegalArgumentException("Vehicle capacity must be a positive finite value.");
        }
        this.vehicleId = vehicleId;
        this.capacityKg = capacityKg;
    }

    public String getVehicleId() { return vehicleId; }
    public double getCapacityKg() { return capacityKg; }

    public boolean isAvailable() { return available; }
    public void setAvailable(boolean available) { this.available = available; }

    // POLYMORPHISM: every vehicle type applies its own load rule
    public abstract boolean canCarry(double loadKg);

    public abstract String getVehicleType();

    @Override
    public String toString() {
        return vehicleId + " | " + getVehicleType() + " | Capacity: "
                + capacityKg + " kg | " + (available ? "Available" : "On trip");
    }
}
