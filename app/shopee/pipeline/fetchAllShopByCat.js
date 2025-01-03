/* eslint-disable guard-for-in */
import fs from 'fs';
import axios from 'axios';

const PAGE_SIZE = 60;

const main = async () => {
	// read data from file and parse to json
	const shopeeCatList = JSON.parse(
		fs.readFileSync('./data/shopeeCatList.json', 'utf8'),
	);

	const shopList = {};
	for (const cat of shopeeCatList) {
		console.log(`Fetching cat ${cat.display_name}`);
		let offset = 0;

		while (true) {
			const url = `https://shopee.vn/api/v4/recommend/recommend?bundle=category_landing_page&cat_level=2&catid=${cat.catid}&limit=60&offset=${offset}`;

			const res = await axios.get(url);
			const productList = ((res.data?.data?.sections || [])[0] || {}).data?.item || [];

			for (const product of productList) {
				// skip official shop because we already have it
				if (!product.is_official_shop) {
					const shopId = product.shopid;
					const shopName = product.shop_name;

					shopList[shopId] = {
						shopName,
						parent_catid: cat.parent_catid,
					};
				}
			}

			// eslint-disable-next-line guard-for-in
			const output = [];
			for (const shopId in shopList) {
				const shopData = shopList[shopId];

				// replace space to underscore
				// remove special characters (emojis, etc.) except underscore and dot
				const shopNameProcessed = shopData.shopName.replace(/ /g, '_').replace(/[^\w.]/g, '');

				output.push({
					shopId,
					shopName: shopNameProcessed,
					shopNameRaw: shopData.shopName,
					parent_catid: shopData.parent_catid,
				});
			}

			console.log(`Fetched ${offset} products`);
			console.log(`Found ${output.length} shops`);

			// sort by parent_catid
			output.sort((a, b) => a.parent_catid - b.parent_catid);
			fs.writeFileSync('./data/shopList_output.json', JSON.stringify(output, null, 4));

			// break if
			if (!((res.data?.data?.sections || [])[0] || {}).has_more) {
				break;
			}

			offset += PAGE_SIZE;
		}
	}
};

main();
