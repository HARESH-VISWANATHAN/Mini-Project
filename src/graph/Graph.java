package graph;

import java.util.*;

/**
 * Weighted, two-way road network (adjacency list).
 * Dijkstra's algorithm is written by hand and uses a PriorityQueue as a min-heap.
 * Blocked roads are skipped, so a blocked road can make a shop unreachable.
 */
public class Graph {

    private final Map<String, List<Edge>> adjacencyList = new TreeMap<>();
    private final Set<String> blockedRoads = new HashSet<>();

    // ---------- building the network ----------

    public void addNode(String node) {
        adjacencyList.putIfAbsent(node, new ArrayList<>());
    }

    /** Adds a two-way road. Travel time must be positive. */
    public void addRoad(String a, String b, double travelTime) {
        if (travelTime <= 0) {
            throw new IllegalArgumentException("Travel time must be positive.");
        }
        addNode(a);
        addNode(b);
        adjacencyList.get(a).add(new Edge(b, travelTime));
        adjacencyList.get(b).add(new Edge(a, travelTime));
    }

    public boolean containsNode(String node) {
        return adjacencyList.containsKey(node);
    }

    private List<Edge> getEdges(String node) {
        return adjacencyList.getOrDefault(node, Collections.emptyList());
    }

    // ---------- blocked roads ----------

    public boolean roadExists(String a, String b) {
        for (Edge edge : getEdges(a)) {
            if (edge.getDestination().equals(b)) {
                return true;
            }
        }
        return false;
    }

    public boolean blockRoad(String a, String b) {
        if (!roadExists(a, b)) {
            return false;
        }
        blockedRoads.add(roadKey(a, b));
        return true;
    }

    public boolean unblockRoad(String a, String b) {
        return blockedRoads.remove(roadKey(a, b));
    }

    public boolean isBlocked(String a, String b) {
        return blockedRoads.contains(roadKey(a, b));
    }

    // Same key for A-B and B-A, because roads work both ways
    private String roadKey(String a, String b) {
        return a.compareTo(b) < 0 ? a + "|" + b : b + "|" + a;
    }

    // ---------- Dijkstra's algorithm ----------

    // An entry in the min-heap: a location and the time to reach it
    private static class HeapEntry {
        final String node;
        final double time;

        HeapEntry(String node, double time) {
            this.node = node;
            this.time = time;
        }
    }

    // What one Dijkstra run produces
    private static class ShortestPaths {
        final Map<String, Double> time = new HashMap<>();      // fastest time to each node
        final Map<String, String> previous = new HashMap<>();  // step before each node
    }

    private ShortestPaths runDijkstra(String source) {
        ShortestPaths result = new ShortestPaths();
        if (!containsNode(source)) {
            return result;
        }
        for (String node : adjacencyList.keySet()) {
            result.time.put(node, Double.POSITIVE_INFINITY);
        }
        result.time.put(source, 0.0);

        // smallest time first; equal times are ordered by name (deterministic)
        PriorityQueue<HeapEntry> heap = new PriorityQueue<>(
                Comparator.<HeapEntry>comparingDouble(entry -> entry.time)
                        .thenComparing(entry -> entry.node));
        heap.add(new HeapEntry(source, 0.0));

        while (!heap.isEmpty()) {
            HeapEntry current = heap.poll();
            if (current.time > result.time.get(current.node)) {
                continue;   // an outdated entry: a faster way was already found
            }
            for (Edge edge : getEdges(current.node)) {
                String next = edge.getDestination();
                if (isBlocked(current.node, next)) {
                    continue;   // closed road
                }
                double newTime = current.time + edge.getTravelTime();
                if (newTime < result.time.get(next)) {
                    result.time.put(next, newTime);
                    result.previous.put(next, current.node);
                    heap.add(new HeapEntry(next, newTime));
                }
            }
        }
        return result;
    }

    /** Fastest travel time from source to EVERY node (infinity = unreachable). */
    public Map<String, Double> distancesFrom(String source) {
        return runDijkstra(source).time;
    }

    /** Fastest route with its path, or null if the destination is unreachable. */
    public RouteResult shortestRoute(String source, String destination) {
        ShortestPaths paths = runDijkstra(source);
        Double time = paths.time.get(destination);
        if (time == null || time == Double.POSITIVE_INFINITY) {
            return null;
        }
        // walk backwards from the destination to the source
        LinkedList<String> path = new LinkedList<>();
        for (String at = destination; at != null; at = paths.previous.get(at)) {
            path.addFirst(at);
        }
        return new RouteResult(time, path);
    }

    // ---------- display ----------

    public void displayGraph() {
        for (Map.Entry<String, List<Edge>> entry : adjacencyList.entrySet()) {
            StringBuilder line = new StringBuilder();
            for (Edge edge : entry.getValue()) {
                if (line.length() > 0) {
                    line.append(", ");
                }
                line.append(edge);
                if (isBlocked(entry.getKey(), edge.getDestination())) {
                    line.append(" [BLOCKED]");
                }
            }
            System.out.println(entry.getKey() + " -> " + line);
        }
    }
}
