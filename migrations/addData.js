import '../config/env.js';
import '../config/mongoose.js';
import Products from '../models/Products.js';

const main = async () => {
	const products = await Products.getAllProduct();

	for (const product of products) {
		const { group, _id, url } = product;

		if (!group) {
			const domain = new URL(url).hostname;
			await Products.updateProductById(_id, {
				group: domain,
				originalImages: [],
			});
			console.log(`Product ${_id} updated`);
		}
	}
};

main();