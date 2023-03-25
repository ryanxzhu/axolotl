function resetWithin2PI(angle) {
    angle = angle < 0 ? angle + Math.PI * 2 : angle;
    angle = angle >= Math.PI * 2 ? angle - Math.PI * 2 : angle;

    return angle;
}

function binarySearch(row, target, offset = 0) {
    let left = 0;
    let right = row.length - 1;
    let middle = Math.floor((left + right) / 2);
    while (left < right) {
        if (row[middle] < target) {
            left = middle + 1;
        } else {
            right = middle;
        }
        middle = Math.floor((left + right) / 2);
    }
    return middle - offset;
}
