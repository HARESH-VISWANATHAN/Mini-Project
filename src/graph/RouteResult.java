package graph;

import java.util.ArrayList;
import java.util.List;

/** The answer of a shortest-route search: the path and its travel time. */
public class RouteResult {

    private final double travelTime;
    private final List<String> path;

    public RouteResult(double travelTime, List<String> path) {
        this.travelTime = travelTime;
        this.path = new ArrayList<>(path);
    }

    public double getTravelTime() { return travelTime; }
    public List<String> getPath() { return new ArrayList<>(path); }

    @Override
    public String toString() {
        return String.join(" -> ", path) + " (" + travelTime + " min)";
    }
}
