import fs from 'fs';
import dotenv from 'dotenv';
import Scraper, { DEBUG_SCREENSHOT } from './Scraper';
import Discord from './Discord';

const DATABASE_CSV = 'listings.csv';

// Init
dotenv.config();

async function rerunAfter(seconds: number, callback: () => Promise<void>) {
	const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

	await callback();
	await wait(seconds * 1000);

	rerunAfter(seconds, callback);
}

async function pushToMemory(listingId: string, vendor: 'canadacomputers') {
	return new Promise<void>(resolve => {
		fs.appendFile(DATABASE_CSV, `${vendor}, ${listingId}, ${new Date().toISOString()},\n`, (err) => {
			if (err) {
				throw err;
			}

			resolve();
		});
	});
}

async function scrapeCanadaComputers({ scraper, discord }: { scraper: Scraper, discord: Discord }) {
	const [page, listings] = await scraper.search(
		process.env.CC_SEARCH_URL as string,
		'#product-list',
		'[data-item-id]',
		nodes => {
			const getId = (node: Element) => {
				const defaultId = 'no-id';

				const content = node.querySelector('span.d-none.d-sm-inline.font-weight-bold')?.innerHTML;

				if (!content) {
					return defaultId;
				}

				return content.match(/(?<id>[A-Z0-9]{10,10})/)?.groups?.id || defaultId;
			}

			const getPrice = (node: Element) => {
				return node.querySelector('.pq-hdr-product_price strong')?.innerHTML;
			}

			const getTitle = (node: Element) => {
				return node.querySelector('.productTemplate_title a')?.innerHTML;
			}

			const getLink = (node: Element) => {
				return node.querySelector<HTMLLinkElement>('.productTemplate_title a')?.href;
			}

			const getStocks = (node: Element) => {
				const id = node.parentNode?.querySelector('[data-item-id]')?.getAttribute('data-item-id');

				if (!id) {
					return [id];
				}

				const locationPanel = document.querySelector(`.stocklevel-pop.stocklevel-pop-${id}`);

				if (!locationPanel) {
					return [id];
				}

				const stockNumberNodes = locationPanel.querySelectorAll('.stocknumber');

				const locations = Array.from(stockNumberNodes).map(stockNode => {
					const item: Element = (stockNode as any).parentNode.parentNode.parentNode.parentNode;

					return {
						location: item.querySelector('a')?.innerHTML,
						qty: stockNode.innerHTML
					};
				});

				return locations.filter(location => location.qty !== '<strong>-</strong>');
			}

			const getStocked = (node: Element) => {
				return !!node.querySelector('[data-stocklevel-pop-id] .pq-hdr-bolder');
			}

			const getPayload = (node: Element) => {
				return {
					id: getId(node),
					price: getPrice(node),
					title: getTitle(node),
					link: getLink(node),
					stocks: getStocks(node),
					isStocked: getStocked(node),
				}
			}

			return Array.from(nodes).map(getPayload)
				.filter(payload => payload.isStocked);
		},
	);

	const favorites = (process.env.CC_FAVORITE_ITEM_CODES as string).split(',');
	const locationWhitelist = (process.env.LOCATION_WHITELIST as string).split(',');

	const promises = listings
		.filter((listing: any) => {
			return listing.stocks.some((stock: any) => locationWhitelist.includes(stock.location));
		})
		.map(async(listing: any) => {
			const f = '```';
			const textStyle = favorites.includes(listing.id as string) ? 'fix' : '';

			const listStocks = (stocks: any) => {
				return stocks
					.filter((stock: any) => locationWhitelist.includes(stock.location))
					.sort((stockA: any, stockB: any) => {
						const stockAHasLowerIndex = locationWhitelist.indexOf(stockA.location) < locationWhitelist.indexOf(stockB.location);

						return stockAHasLowerIndex ? -1 : 1;
					})
					.map((stock: any) => `${stock.location}: ${stock.qty}`).join(', ');
			};

			await discord.send(
				[
					`${listing.link}`,
					`${f}${textStyle}`,
					`| ID: ${listing.id}`,
					`| TITLE: ${listing.title}`,
					`| PRICE: ${listing.price}`,
					`| STOCK: ${listStocks(listing.stocks)}`,
					`${f}`,
				].join('\n')
			);

			pushToMemory(listing.id, 'canadacomputers');
		});

	await page?.close();
}

(async () => {
	const discord = await Discord.init();
	const scraper = await Scraper.init();

	discord.onMessage(message => {
		if (message.author.id === discord.user?.id) {
			return;
		}

		switch (message.content) {
			case 'ping':
				discord.send('pong', message.channel.id);
				break;

			case 'pong':
				discord.send('ping', message.channel.id);
				break;

			case '!csv':
				discord.send({
					files: [`./${DATABASE_CSV}`],
				});
				break;

			case '!debug':
				if ((process.env.DEBUG || '').toUpperCase() === 'TRUE') {
					discord.send({
						files: [`./${DEBUG_SCREENSHOT}`],
					});
				}
				break;

			case '!stock':
				discord.send('https://youtu.be/dQw4w9WgXcQ');
				break;
		}
	});

	rerunAfter(parseInt(process.env.CYCLE_TIMEOUT as string), async() => {
		await scrapeCanadaComputers({ scraper, discord });
	});
})();
