export const CONTRACT_SERVICE_SNAPSHOT_SELECT = {
  masterServiceId: true,
  serviceCodeSnapshot: true,
  serviceNameSnapshot: true,
  serviceDescriptionSnapshot: true,
  categoryIdSnapshot: true,
  categoryCodeSnapshot: true,
  categoryNameSnapshot: true,
  categorySortOrderSnapshot: true,
} as const;

export const CONTRACT_SERVICE_ITEMS_INCLUDE = {
  orderBy: [
    { categorySortOrderSnapshot: "asc" as const },
    { serviceNameSnapshot: "asc" as const },
    { id: "asc" as const },
  ],
};
