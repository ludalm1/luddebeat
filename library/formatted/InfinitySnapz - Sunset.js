c = 1.51873344 * t,
n1 = [1875, 3750, 7500],
p1 = [1, 0.8, 0.75, 0.5, 0.25],
p2 = [0.89, 0.75, 2 / 3, 0.6, 0.3],
p3 = [0.8, 0.75, 2 / 3, 0.5, 0.25],
p4 = [0.75, 2 / 3, 0.6, 0.375, 0.1875],
o1 = [
	p1[int(t / 15E3) % 4],
	p2[int(t / 15E3) % 4],
	p3[int(t / 15E3) % 4],
	p4[int(t / 15E3) % 4]
],
o2 = [0.5, 0.445, 0.4, 0.375],
o3 = [
	p1[abs(int(t / n1[int(t / 24E4) % 3] % 4) % 8 - 4)],
	p2[abs(int(t / n1[int(t / 24E4) % 3]) % 8 - 4)],
	p3[abs(int(t / n1[int(t / 24E4) % 3]) % 8 - 4)],
	p4[abs(int(t / n1[int(t / 24E4) % 3]) % 8 - 4)]
],
c * o1[int(t / 24E4) % 4] % 256 / 4 +
	c / 1.01 * o2[int(t / 24E4) % 4] % 256 / 4 +
	4.02 * c * o3[int(t / 24E4) % 4] % 256 / 6 +
	20 * random() +
	sqrt(5E12 * random()) / (t % 24E4) % 256 / 3;
