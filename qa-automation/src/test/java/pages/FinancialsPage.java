package pages;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class FinancialsPage {

    private final WebDriver driver;

    private final By heading =
            By.xpath(
                "//h1[contains(.,'Financial')]"
            );

    private final By links =
            By.cssSelector("a");

    public FinancialsPage(WebDriver driver) {

        this.driver = driver;
    }

    public void open() {

        driver.get(
                System.getProperty(
                        "ui.base.url",
                        "https://YOUR-NETLIFY-URL.netlify.app"
                )
        );
    }

    public boolean pageContainsFinancialContent() {

        String pageText =
                driver.findElement(
                        By.tagName("body")
                ).getText();

        return pageText
                .toLowerCase()
                .contains("financial");
    }

    public boolean hasLinks() {

        return driver.findElements(
                links
        ).size() > 0;
    }
}