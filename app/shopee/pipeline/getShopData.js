/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-loop-func */
import axios from 'axios';
import fs from 'fs';
// import cookie from 'cookie';

import { saveFileFromURL } from '../../../utils/file/saveFileFromURL.js';
import logger from '../../../config/log.js';
import { delay } from '../../../utils/delay.js';
import { STORAGE_PREFIX } from '../../../config/config.js';
import { bucketName } from '../../storage/setupStorage.js';
// import productAPI from '../../../api/productAPI.js';
import Products from '../../../models/Products.js';

const PAGE_SIZE = 100;
const MAX_DOWNLOAD_IMAGE = 	10 * 60 * 1000;
const userCookiePath = './app/shopee/config/userCookie.txt';
let currentCookie = null;

const timeoutDownloadImage = new Promise((resolve) => {
	setTimeout(() => {
		resolve();
	}, MAX_DOWNLOAD_IMAGE);
});

const downloadImage = async (product, shopName, images) => {
	const imagesPromise = images.map(async (imageLink, i) => {
		const imgPath = `${STORAGE_PREFIX}/${shopName}/${product._id}_${i}_${shopName.replace(/[^a-zA-Z0-9]/g, '_')}.jpeg`;

		console.log('Start download image', imageLink);
		const saveStatus = await saveFileFromURL(imageLink, imgPath);
		console.log('End download image', imageLink);

		if (!saveStatus) {
			return null;
		}

		return `https://storage.googleapis.com/${bucketName}/${imgPath}`;
	});
	const imageLinks = await Promise.all(imagesPromise);
	const imageLinksFiltered = imageLinks.filter((imageLink) => imageLink !== null);
	return imageLinksFiltered;
};

export default async function getShopData(shopId, shopName) {
	logger.info(`Downloading shop ${shopName} - ${shopId}`);
	let offSet = 0;

	const downloadedURL = await Products.getDownloadedProductURLByShopName(shopName);

	while (true) {
		logger.info(`Downloading page ${offSet / PAGE_SIZE + 1} of shop ${shopName}`);
		const API_ENDPOINT = `https://shopee.vn/api/v4/shop/rcmd_items?bundle=shop_page_category_tab_main&limit=${PAGE_SIZE}&offset=${offSet}&shop_id=${shopId}`;

		// get cookie
		if (!currentCookie) {
			// in first time, read cookie from file
			currentCookie = fs.readFileSync(userCookiePath, 'utf8');
		}

		const res = await axios.get(API_ENDPOINT, {
			headers: {
				cookie: currentCookie.trim(),
				'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
			},
		});

		// update cookie for next request
		// const setCookieHeader = res.headers['set-cookie'];
		// if (setCookieHeader) {
		// 	const cookies = setCookieHeader.map(cookie.parse);

		// 	console.log(Object.entries(cookies));
		// 	const serializedCookies = Object.entries(cookies)
		// 		.map(([key, value]) => `${key}=${value}`)
		// 		.join('; ');

		// 	currentCookie = serializedCookies;
		// 	fs.writeFileSync(userCookiePath, serializedCookies);
		// }

		const data = res.data.data;

		if (!data || !(data.items || []).length) {
			logger.info(`No more data for shop ${shopName}`);
			break;
		}
		const items = data.items;

		for (const item of items) {
			const {
				name,
				itemid,
				price,
			} = item;

			let {
				images,
			} = item;
			images = images.map((image) => `https://down-vn.img.susercontent.com/file/${image}`);

			const url = `https://shopee.vn/product/${shopId}/${itemid}`;
			const description = name;

			if (downloadedURL[url]) {
				continue;
			}

			logger.info(`Downloading item ${name}`);
			// const product = await productAPI.insertNewProduct({
			// 	title: name,
			// 	price: price / 1e5,
			// 	originalImages: images,
			// 	description,
			// 	url,
			// 	shopName,
			// 	metadata: {},
			// });
			const product = await Products.insertNewProduct({
				title: name,
				price: price / 1e5,
				originalImages: images,
				description,
				url,
				shopName,
				metadata: {},
				active: true,
			});

			// download image in imageLinks
			// filter null\
			const imageLinks = await Promise.race([
				downloadImage(product, shopName, images),
				timeoutDownloadImage,
			]);

			if (!imageLinks) {
				logger.error(`Timeout download image for item ${name}`);
				logger.error(shopId, itemid);

				// remove product
				await Products.deleteProductById(product._id);
				continue;
			}

			// save product image path to database
			await Products.updateProductById(product._id, {
				images: imageLinks,
				activeImageMap: imageLinks.map(() => true),
			});
			await delay(0.2 * 1000);
		}

		// sleep 30s
		await delay(10 * 1000);
		offSet += PAGE_SIZE;
	}
}
