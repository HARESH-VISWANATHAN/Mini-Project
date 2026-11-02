package policy;

import model.DeliveryRequest;

import java.util.Comparator;

/** Most urgent shortage first; if equal, the earlier request; then by request ID. */
public class ShortagePriorityPolicy extends ReplenishmentPolicy {

    @Override
    public Comparator<DeliveryRequest> getComparator() {
        return Comparator
                .comparingInt(DeliveryRequest::getUrgency).reversed()   // 1. most urgent first
                .thenComparingLong(DeliveryRequest::getArrivalOrder)    // 2. earliest arrival
                .thenComparing(DeliveryRequest::getRequestId);          // 3. fixed final tie-break
    }
}
