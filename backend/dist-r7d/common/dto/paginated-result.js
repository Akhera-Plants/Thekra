export function buildPageMeta(page, limit, total, extras = {}) {
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        ...extras,
    };
}
export function paginated(data, page, limit, total, extras = {}) {
    return { data, meta: buildPageMeta(page, limit, total, extras) };
}
//# sourceMappingURL=paginated-result.js.map