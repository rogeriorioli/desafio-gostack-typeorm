import Transaction from '../models/Transaction';
import csvParse from 'csv-parse'

import { In, getRepository , getCustomRepository } from 'typeorm';

import fs from 'fs'
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';
interface CSV {
  title : string,
  value : number,
  type : "income" | "outcome",
  category : string
}

class ImportTransactionsService {
  async execute(filepath :string): Promise<Transaction[]> {
    const contactReadStream = fs.createReadStream(filepath)
    const categoriesRepository = getRepository(Category)
    const transactionsRepository = getCustomRepository(TransactionsRepository)
    const parsers = csvParse({
     from_line : 2,
     
    })
    const parseCSV = contactReadStream.pipe(parsers);

    const transactions : CSV[] = []
    const categories : string[] = []

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) => cell.trim())

      if(!title || !type  || !value) return;

      categories.push(category)

      transactions.push({title, type, value, category})
    })

    await new Promise(resolve => parseCSV.on('end', resolve))
    const existen = await categoriesRepository.find({
      where : {
        title : In(categories)
      }
    })

    const existeTitle = existen.map((category: Category) => category.title)

    const addCategoryTitles = categories
    .filter(category => !existeTitle.includes(category))
    .filter((value, index, self) => self.indexOf(value) === index)

    const newCategories= categoriesRepository.create(
      addCategoryTitles.map(title => ({
          title,
      }))
    )

    await categoriesRepository.save(newCategories)

    const finalCategories= [...newCategories , ...existen]

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => (
        {
          title : transaction.title,
          type : transaction.type,
          value: transaction.value,
          category : finalCategories.find(category => category.title === transaction.category)
        }
      ))
    )
  
    await transactionsRepository.save(createdTransactions)

    await fs.promises.unlink(filepath)
  }
}
export default ImportTransactionsService;