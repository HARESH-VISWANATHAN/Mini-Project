package graph;

/** One road leading to a neighbouring location. */
public class Edge {

    private final String destination;
    private final double travelTime;   // minutes

    public Edge(String destination, double travelTime) {
        this.destination = destination;
        this.travelTime = travelTime;
    }

    public String getDestination() { return destination; }
    public double getTravelTime() { return travelTime; }

    @Override
    public String toString() {
        return destination + " (" + travelTime + " min)";
    }
}
