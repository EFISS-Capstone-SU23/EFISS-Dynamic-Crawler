import Templates from '../models/Templates.js';

const findTemplateList = async (req, res) => {
	const page = parseInt(req.query.page, 10) || 1;
	const pageSize = parseInt(req.query.pageSize, 10) || 20;

	const {
		query,
	} = req.body;

	const data = await Templates.findTemplateList(page, pageSize, query);
	const total = await Templates.countAllTemplates();

	res.json({
		data,
		total,
		page,
		hasNext: (page + 1) * pageSize < total,
	});
};

const insertNewTemplate = async (req, res) => {
	const {
		template,
	} = req.body;

	const website = new URL(template.startUrl).hostname;

	// check if website exist
	const websiteExist = await Templates.findOneByWebsite(website);
	if (websiteExist) {
		res.status(400).json({
			message: 'Website already exist',
		});
		return;
	}

	// TODO: set addedBy to current user
	const addedBy = 'admin';

	const templateData = {
		addedBy,
		template,
		website,
	};
	const data = await Templates.insertNewTemplate(templateData);

	res.json({
		data,
	});
};

export default {
	findTemplateList,
	insertNewTemplate,
};