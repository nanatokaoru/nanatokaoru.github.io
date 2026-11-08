import { test, expect } from '@playwright/test'

test('home to main part to first chapter read and back', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '奈奈与薰的SM日记' })).toBeVisible()
  await page.getByRole('link', { name: /从本篇开始读/ }).click()
  await expect(page).toHaveURL(/\/part\/main/)
  await page.getByRole('link', { name: /第1话/ }).first().click()
  await expect(page).toHaveURL(/\/read\?/)
  await expect(page.getByText(/妄想/)).toBeVisible()
  await page.getByRole('link', { name: /返回/ }).click()
  await expect(page).toHaveURL(/\/part\/main/)
})

test('summer part opens color gallery', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /夏日篇/ }).click()
  await expect(page).toHaveURL(/\/part\/summer/)
  await page.getByRole('link', { name: /彩图/ }).click()
  await expect(page).toHaveURL(/\/gallery\/pictures/)
})
