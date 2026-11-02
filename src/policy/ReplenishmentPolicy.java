package policy;

import model.DeliveryRequest;

import java.util.Comparator;

/**
 * ABSTRACTION: how shortage requests are ranked.
 * The PriorityQueue in DispatchService uses this comparator, so a new ranking
 * rule can be added by writing a new subclass - nothing else has to change.
 */
public abstract class ReplenishmentPolicy {

    public abstract Comparator<DeliveryRequest> getComparator();
}
